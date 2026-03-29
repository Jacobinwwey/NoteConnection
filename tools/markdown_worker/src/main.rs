use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;

use pulldown_cmark::{Event, Options, Parser, Tag};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerRequest {
    kind: String,
    file_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkerResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    index: Option<WorkerIndexPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkerIndexPayload {
    total_bytes: usize,
    total_lines: usize,
    blocks: Vec<WorkerBlock>,
    anchors: Vec<WorkerAnchor>,
    wiki_links: Vec<WorkerWikiLink>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkerBlock {
    id: usize,
    r#type: String,
    start_byte: usize,
    end_byte: usize,
    start_line: usize,
    end_line: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    anchor_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkerAnchor {
    anchor_id: String,
    text: String,
    block_id: usize,
    start_byte: usize,
    end_byte: usize,
    start_line: usize,
    end_line: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkerWikiLink {
    raw: String,
    wiki_target: String,
    file_target: String,
    heading: String,
    alias: String,
    block_id: usize,
    start_byte: usize,
    start_line: usize,
}

#[derive(Debug)]
struct ActiveBlock {
    block_type: String,
    start_byte: usize,
    end_byte: usize,
    text: String,
    heading_level: Option<u8>,
}

fn main() {
    let response = match read_request().and_then(handle_request) {
        Ok(index) => WorkerResponse {
            ok: true,
            index: Some(index),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            index: None,
            error: Some(error),
        },
    };

    if let Ok(serialized) = serde_json::to_string(&response) {
        println!("{}", serialized);
    } else {
        println!(
            "{{\"ok\":false,\"error\":\"Failed to serialize markdown worker response\"}}"
        );
    }
}

fn read_request() -> Result<WorkerRequest, String> {
    let mut stdin_text = String::new();
    io::stdin()
        .read_to_string(&mut stdin_text)
        .map_err(|err| format!("Failed to read worker stdin payload: {}", err))?;
    if stdin_text.trim().is_empty() {
        return Err("Worker request payload is empty.".to_string());
    }
    serde_json::from_str::<WorkerRequest>(&stdin_text)
        .map_err(|err| format!("Failed to parse worker request JSON: {}", err))
}

fn handle_request(request: WorkerRequest) -> Result<WorkerIndexPayload, String> {
    let kind = request.kind.trim().to_lowercase();
    if kind != "build_index" {
        return Err(format!("Unsupported worker request kind: {}", request.kind));
    }

    let file_path = PathBuf::from(request.file_path.trim());
    if file_path.as_os_str().is_empty() {
        return Err("Missing filePath for build_index request.".to_string());
    }

    build_index(file_path)
}

fn build_index(file_path: PathBuf) -> Result<WorkerIndexPayload, String> {
    let content_bytes = fs::read(&file_path)
        .map_err(|err| format!("Failed to read markdown file '{}': {}", file_path.display(), err))?;
    let content = String::from_utf8(content_bytes.clone()).map_err(|err| {
        format!(
            "Markdown file '{}' is not valid UTF-8: {}",
            file_path.display(),
            err
        )
    })?;

    let line_starts = build_line_starts(&content_bytes);
    let mut blocks: Vec<WorkerBlock> = Vec::new();
    let mut anchors: Vec<WorkerAnchor> = Vec::new();
    let mut active_block: Option<ActiveBlock> = None;
    let mut depth: usize = 0;
    let mut next_block_id: usize = 0;

    let parser = Parser::new_ext(&content, Options::all()).into_offset_iter();
    for (event, range) in parser {
        match event {
            Event::Start(tag) => {
                if depth == 0 {
                    if let Some((block_type, heading_level)) = classify_start_tag(&tag) {
                        active_block = Some(ActiveBlock {
                            block_type,
                            start_byte: range.start,
                            end_byte: range.end,
                            text: String::new(),
                            heading_level,
                        });
                    }
                }
                depth = depth.saturating_add(1);
            }
            Event::End(_) => {
                if let Some(block) = active_block.as_mut() {
                    block.end_byte = range.end;
                }
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    if let Some(block) = active_block.take() {
                        finalize_block(
                            block,
                            &mut blocks,
                            &mut anchors,
                            &mut next_block_id,
                            &line_starts,
                            content_bytes.len(),
                        );
                    }
                }
            }
            Event::Text(text) => {
                if let Some(block) = active_block.as_mut() {
                    block.text.push_str(&text);
                }
            }
            Event::Code(text) => {
                if let Some(block) = active_block.as_mut() {
                    block.text.push_str(&text);
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if let Some(block) = active_block.as_mut() {
                    block.text.push('\n');
                }
            }
            Event::Rule => {
                let start_byte = range.start.min(content_bytes.len());
                let end_byte = range.end.min(content_bytes.len()).max(start_byte);
                let start_line = line_from_byte(&line_starts, start_byte);
                let end_line = line_from_byte(&line_starts, end_byte.saturating_sub(1));
                blocks.push(WorkerBlock {
                    id: next_block_id,
                    r#type: "rule".to_string(),
                    start_byte,
                    end_byte,
                    start_line,
                    end_line,
                    anchor_id: None,
                });
                next_block_id = next_block_id.saturating_add(1);
            }
            _ => {}
        }
    }

    if blocks.is_empty() && !content_bytes.is_empty() {
        let start_line = 1;
        let end_line = line_from_byte(&line_starts, content_bytes.len().saturating_sub(1));
        blocks.push(WorkerBlock {
            id: 0,
            r#type: "paragraph".to_string(),
            start_byte: 0,
            end_byte: content_bytes.len(),
            start_line,
            end_line,
            anchor_id: None,
        });
    }

    let wiki_links = extract_wiki_links(&content, &blocks, &line_starts)?;

    Ok(WorkerIndexPayload {
        total_bytes: content_bytes.len(),
        total_lines: line_starts.len(),
        blocks,
        anchors,
        wiki_links,
    })
}

fn classify_start_tag(tag: &Tag<'_>) -> Option<(String, Option<u8>)> {
    match tag {
        Tag::Paragraph => Some(("paragraph".to_string(), None)),
        Tag::Heading { level, .. } => Some(("heading".to_string(), Some(*level as u8))),
        Tag::BlockQuote(_) => Some(("blockquote".to_string(), None)),
        Tag::CodeBlock(_) => Some(("code".to_string(), None)),
        Tag::List(_) => Some(("list".to_string(), None)),
        Tag::Item => Some(("list_item".to_string(), None)),
        Tag::Table(_) => Some(("table".to_string(), None)),
        Tag::FootnoteDefinition(_) => Some(("footnote".to_string(), None)),
        Tag::HtmlBlock => Some(("html".to_string(), None)),
        _ => None,
    }
}

fn finalize_block(
    active: ActiveBlock,
    blocks: &mut Vec<WorkerBlock>,
    anchors: &mut Vec<WorkerAnchor>,
    next_block_id: &mut usize,
    line_starts: &[usize],
    content_len: usize,
) {
    let start_byte = active.start_byte.min(content_len);
    let mut end_byte = active.end_byte.min(content_len);
    if end_byte < start_byte {
        end_byte = start_byte;
    }
    if end_byte == start_byte && end_byte < content_len {
        end_byte += 1;
    }

    let start_line = line_from_byte(line_starts, start_byte);
    let end_line = line_from_byte(line_starts, end_byte.saturating_sub(1));
    let heading_anchor = if active.heading_level.is_some() {
        let slug = slugify_heading(&active.text);
        if slug.is_empty() {
            None
        } else {
            Some(slug)
        }
    } else {
        None
    };

    let block = WorkerBlock {
        id: *next_block_id,
        r#type: active.block_type,
        start_byte,
        end_byte,
        start_line,
        end_line,
        anchor_id: heading_anchor.clone(),
    };

    if let Some(anchor_id) = heading_anchor {
        anchors.push(WorkerAnchor {
            anchor_id,
            text: active.text.trim().to_string(),
            block_id: block.id,
            start_byte: block.start_byte,
            end_byte: block.end_byte,
            start_line: block.start_line,
            end_line: block.end_line,
        });
    }

    blocks.push(block);
    *next_block_id = next_block_id.saturating_add(1);
}

fn build_line_starts(content: &[u8]) -> Vec<usize> {
    if content.is_empty() {
        return vec![0];
    }
    let mut starts = vec![0];
    for (index, byte) in content.iter().enumerate() {
        if *byte == b'\n' && index + 1 < content.len() {
            starts.push(index + 1);
        }
    }
    starts
}

fn line_from_byte(line_starts: &[usize], byte: usize) -> usize {
    if line_starts.is_empty() {
        return 1;
    }
    match line_starts.binary_search(&byte) {
        Ok(index) => index + 1,
        Err(index) => {
            if index == 0 {
                1
            } else {
                index
            }
        }
    }
}

fn slugify_heading(value: &str) -> String {
    let mut slug = String::new();
    let mut pending_dash = false;
    for ch in value.trim().to_lowercase().chars() {
        if ch.is_alphanumeric() {
            if pending_dash && !slug.is_empty() {
                slug.push('-');
            }
            slug.push(ch);
            pending_dash = false;
        } else if ch.is_whitespace() || ch == '-' || ch == '_' {
            pending_dash = true;
        }
    }
    slug.trim_matches('-').to_string()
}

fn extract_wiki_links(
    content: &str,
    blocks: &[WorkerBlock],
    line_starts: &[usize],
) -> Result<Vec<WorkerWikiLink>, String> {
    let regex = Regex::new(r"\[\[([^\]|#]+?)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]")
        .map_err(|err| format!("Failed to compile wiki-link regex: {}", err))?;

    let mut links = Vec::new();
    for captures in regex.captures_iter(content) {
        let Some(full_match) = captures.get(0) else {
            continue;
        };
        let start_byte = full_match.start();
        let raw = full_match.as_str().trim().to_string();
        if raw.is_empty() {
            continue;
        }

        let file_target = captures
            .get(1)
            .map(|value| value.as_str().trim().to_string())
            .unwrap_or_default();
        if file_target.is_empty() {
            continue;
        }
        let heading = captures
            .get(2)
            .map(|value| value.as_str().trim().to_string())
            .unwrap_or_default();
        let alias = captures
            .get(3)
            .map(|value| value.as_str().trim().to_string())
            .unwrap_or_default();
        let block_id = blocks
            .iter()
            .find(|block| start_byte >= block.start_byte && start_byte < block.end_byte)
            .map(|block| block.id)
            .unwrap_or(0);
        let start_line = line_from_byte(line_starts, start_byte);

        links.push(WorkerWikiLink {
            raw: raw.clone(),
            wiki_target: raw,
            file_target,
            heading,
            alias,
            block_id,
            start_byte,
            start_line,
        });
    }

    Ok(links)
}

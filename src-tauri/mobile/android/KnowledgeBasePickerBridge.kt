package __NOTE_PACKAGE__

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.lang.ref.WeakReference

object KnowledgeBasePickerBridge {
    private const val TAG = "KnowledgeBasePicker"
    const val REQUEST_CODE = 19071
    private const val RESULT_FILE = "knowledge_base_picker_result.json"
    private const val MAX_DOCUMENTS = 5000
    private const val MAX_DEPTH = 64
    private const val MAX_DOCUMENT_BYTES = 16L * 1024L * 1024L
    private const val MAX_TOTAL_BYTES = 64L * 1024L * 1024L
    @Volatile private var activeActivity: WeakReference<Activity>? = null

    @JvmStatic
    fun bindActivity(activity: Activity) {
        activeActivity = WeakReference(activity)
    }

    @JvmStatic
    fun requestPick(context: Context): Boolean {
        return try {
            val activity = activeActivity?.get() ?: (context as? Activity)
                ?: throw IllegalStateException("Android Activity context is unavailable")
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse("content://com.android.externalstorage.documents/root/primary"))
                }
            }
            activity.startActivityForResult(intent, REQUEST_CODE)
            true
        } catch (error: Throwable) {
            Log.e(TAG, "Unable to launch Android Storage Access Framework", error)
            false
        }
    }

    @JvmStatic
    fun handleActivityResult(context: Context, requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST_CODE) {
            return false
        }

        val resultFile = File(context.filesDir, RESULT_FILE)
        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            writeResult(resultFile, "cancelled", "", "")
            return true
        }

        val treeUri = data.data!!
        try {
            val flags = data.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            try {
                context.contentResolver.takePersistableUriPermission(treeUri, flags or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (error: SecurityException) {
                Log.w(TAG, "Persistable URI permission was not granted; import remains one-shot", error)
            }
            Thread {
                importSelectedTree(context.applicationContext, treeUri, resultFile)
            }.start()
        } catch (error: Throwable) {
            Log.e(TAG, "Unable to schedule knowledge base import", error)
            writeResult(resultFile, "failed", "", error.message ?: "import_failed")
        }
        return true
    }

    private fun importSelectedTree(context: Context, treeUri: Uri, resultFile: File) {
        val targetRoot = File(context.filesDir, "Knowledge_Base")
        val stagingRoot = File(context.filesDir, ".Knowledge_Base.import-${System.nanoTime()}")
        try {
            val sourceRoot = DocumentFile.fromTreeUri(context, treeUri)
                ?: throw IOException("Selected storage tree is unavailable")
            if (!stagingRoot.mkdirs() && !stagingRoot.isDirectory) {
                throw IOException("Unable to create app-local Knowledge_Base")
            }

            val counters = CopyCounters()
            copyMarkdownTree(sourceRoot, stagingRoot, counters, context.contentResolver, 0)
            replaceImportedTree(targetRoot, stagingRoot, context.filesDir)
            writeResult(resultFile, "completed", targetRoot.absolutePath, treeUri.toString())
        } catch (error: Throwable) {
            Log.e(TAG, "Knowledge base import failed", error)
            stagingRoot.deleteRecursively()
            writeResult(resultFile, "failed", "", error.message ?: "import_failed")
        }
    }

    private fun replaceImportedTree(targetRoot: File, stagingRoot: File, parentDir: File) {
        val backupRoot = File(parentDir, ".Knowledge_Base.previous-${System.nanoTime()}")
        var movedExisting = false
        try {
            if (targetRoot.exists()) {
                if (!targetRoot.renameTo(backupRoot)) {
                    throw IOException("Unable to stage the existing Knowledge_Base")
                }
                movedExisting = true
            }
            if (!stagingRoot.renameTo(targetRoot)) {
                throw IOException("Unable to activate imported Knowledge_Base")
            }
            if (movedExisting) {
                backupRoot.deleteRecursively()
            }
        } catch (error: Throwable) {
            if (movedExisting && !targetRoot.exists()) {
                backupRoot.renameTo(targetRoot)
            }
            throw error
        } finally {
            stagingRoot.deleteRecursively()
            if (backupRoot.exists() && targetRoot.exists()) {
                backupRoot.deleteRecursively()
            }
        }
    }

    @JvmStatic
    fun consumeResult(context: Context): String? {
        val resultFile = File(context.filesDir, RESULT_FILE)
        if (!resultFile.isFile) {
            return null
        }
        return try {
            val result = resultFile.readText(Charsets.UTF_8)
            resultFile.delete()
            result
        } catch (error: Throwable) {
            Log.w(TAG, "Unable to consume picker result", error)
            null
        }
    }

    private class CopyCounters {
        var totalBytes: Long = 0
        var documentCount: Int = 0
    }

    private fun copyMarkdownTree(
        source: DocumentFile,
        target: File,
        counters: CopyCounters,
        resolver: android.content.ContentResolver,
        depth: Int,
    ) {
        if (depth > MAX_DEPTH) {
            throw IOException("Selected knowledge base nesting exceeds the mobile depth budget")
        }
        for (child in source.listFiles()) {
            val safeName = sanitizeName(child.name ?: continue)
            if (safeName.isEmpty()) {
                continue
            }
            if (child.isDirectory) {
                val childTarget = File(target, safeName)
                if (childTarget.exists() && !childTarget.isDirectory) {
                    throw IOException("Duplicate import path: ${childTarget.name}")
                }
                if (!childTarget.mkdirs() && !childTarget.isDirectory) {
                    throw IOException("Unable to create import directory")
                }
                copyMarkdownTree(child, childTarget, counters, resolver, depth + 1)
                continue
            }
            if (!child.isFile || !isMarkdown(child.name)) {
                continue
            }
            if (counters.documentCount >= MAX_DOCUMENTS) {
                throw IOException("Selected knowledge base exceeds the mobile document budget")
            }
            val length = child.length()
            if (length < 0L || length > MAX_DOCUMENT_BYTES || counters.totalBytes + length > MAX_TOTAL_BYTES) {
                throw IOException("Selected knowledge base exceeds the mobile import budget")
            }
            val targetFile = File(target, safeName)
            if (targetFile.exists()) {
                throw IOException("Duplicate import path: ${targetFile.name}")
            }
            val rootCanonical = target.canonicalFile
            if (!targetFile.canonicalFile.path.startsWith(rootCanonical.path + File.separator)) {
                throw IOException("Unsafe import path")
            }
            child.uri.let { uri ->
                resolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(targetFile).use { output ->
                        input.copyTo(output, 32 * 1024)
                    }
                } ?: throw IOException("Unable to read selected document")
            }
            counters.totalBytes += length
            counters.documentCount += 1
        }
    }

    private fun isMarkdown(name: String?): Boolean {
        val lower = (name ?: "").lowercase()
        return lower.endsWith(".md") || lower.endsWith(".markdown")
    }

    private fun sanitizeName(raw: String): String = raw
        .replace("/", "_")
        .replace("\\", "_")
        .replace("..", "_")
        .trim()

    private fun writeResult(file: File, status: String, path: String, detail: String) {
        try {
            file.parentFile?.mkdirs()
            file.writeText(
                JSONObject()
                    .put("status", status)
                    .put("path", path)
                    .put("detail", detail)
                    .toString(),
                Charsets.UTF_8
            )
        } catch (error: Throwable) {
            Log.e(TAG, "Unable to persist picker result", error)
        }
    }
}

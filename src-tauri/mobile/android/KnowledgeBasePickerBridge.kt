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
    private const val JOURNAL_FILE = "knowledge_base_import_journal.v1.json"
    private const val JOURNAL_SCHEMA = 1
    private const val STAGING_PREFIX = ".Knowledge_Base.import-"
    private const val BACKUP_PREFIX = ".Knowledge_Base.previous-"
    private const val MAX_DOCUMENTS = 5000
    private const val MAX_DEPTH = 64
    private const val MAX_DOCUMENT_BYTES = 16L * 1024L * 1024L
    private const val MAX_TOTAL_BYTES = 64L * 1024L * 1024L
    @Volatile private var activeActivity: WeakReference<Activity>? = null
    @Volatile private var importInFlight = false
    private val importLock = Any()

    @JvmStatic
    fun bindActivity(activity: Activity) {
        activeActivity = WeakReference(activity)
        synchronized(importLock) {
            recoverImportTransaction(activity.applicationContext)
        }
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
            synchronized(importLock) {
                if (importInFlight) {
                    writeResult(resultFile, "failed", "", "import_in_progress")
                    return true
                }
                importInFlight = true
            }
            Thread {
                try {
                    importSelectedTree(context.applicationContext, treeUri, resultFile)
                } finally {
                    synchronized(importLock) {
                        importInFlight = false
                    }
                }
            }.start()
        } catch (error: Throwable) {
            synchronized(importLock) {
                importInFlight = false
            }
            Log.e(TAG, "Unable to schedule knowledge base import", error)
            writeResult(resultFile, "failed", "", error.message ?: "import_failed")
        }
        return true
    }

    private fun importSelectedTree(context: Context, treeUri: Uri, resultFile: File) {
        synchronized(importLock) {
            importSelectedTreeLocked(context, treeUri, resultFile)
        }
    }

    private fun importSelectedTreeLocked(context: Context, treeUri: Uri, resultFile: File) {
        val targetRoot = File(context.filesDir, "Knowledge_Base")
        val stagingRoot = File(context.filesDir, "$STAGING_PREFIX${System.nanoTime()}")
        val backupRoot = File(context.filesDir, "$BACKUP_PREFIX${System.nanoTime()}")
        val journalFile = File(context.filesDir, JOURNAL_FILE)
        val journal = ImportJournal(
            phase = "staging",
            stagingName = stagingRoot.name,
            backupName = backupRoot.name,
            treeUri = treeUri.toString(),
        )
        try {
            val sourceRoot = DocumentFile.fromTreeUri(context, treeUri)
                ?: throw IOException("Selected storage tree is unavailable")
            if (!stagingRoot.mkdirs() && !stagingRoot.isDirectory) {
                throw IOException("Unable to create app-local Knowledge_Base")
            }
            writeJournal(journalFile, journal)

            val counters = CopyCounters()
            copyMarkdownTree(sourceRoot, stagingRoot, counters, context.contentResolver, 0)
            replaceImportedTree(targetRoot, stagingRoot, backupRoot, journalFile, journal)
            writeResult(resultFile, "completed", targetRoot.absolutePath, treeUri.toString())
        } catch (error: Throwable) {
            Log.e(TAG, "Knowledge base import failed", error)
            stagingRoot.deleteRecursively()
            // A failed rollback leaves the only known-good corpus in backupRoot; keep it
            // journaled so the next activity bind can recover it instead of deleting data.
            if (!backupRoot.exists()) {
                clearJournal(journalFile)
            } else {
                Log.w(TAG, "Retaining import backup for startup recovery", error)
            }
            writeResult(resultFile, "failed", "", error.message ?: "import_failed")
        }
    }

    private fun replaceImportedTree(
        targetRoot: File,
        stagingRoot: File,
        backupRoot: File,
        journalFile: File,
        journal: ImportJournal,
    ) {
        var movedExisting = false
        try {
            if (targetRoot.exists()) {
                if (!targetRoot.renameTo(backupRoot)) {
                    throw IOException("Unable to stage the existing Knowledge_Base")
                }
                movedExisting = true
                writeJournal(journalFile, journal.copy(phase = "target-backed-up"))
            }
            if (!stagingRoot.renameTo(targetRoot)) {
                throw IOException("Unable to activate imported Knowledge_Base")
            }
            writeJournal(journalFile, journal.copy(phase = "target-activated"))
            if (movedExisting) {
                backupRoot.deleteRecursively()
            }
            clearJournal(journalFile)
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

    private data class ImportJournal(
        val phase: String,
        val stagingName: String,
        val backupName: String,
        val treeUri: String,
    )

    private fun recoverImportTransaction(context: Context) {
        val filesDir = context.filesDir
        val journalFile = File(filesDir, JOURNAL_FILE)
        val resultFile = File(filesDir, RESULT_FILE)
        val journal = readJournal(journalFile)
        if (journal == null) {
            if (journalFile.isFile) {
                journalFile.delete()
                writeResult(resultFile, "failed", "", "invalid_import_journal")
                return
            }
            recoverOrphanedTransactions(filesDir, resultFile)
            return
        }

        val targetRoot = File(filesDir, "Knowledge_Base")
        val stagingRoot = File(filesDir, journal.stagingName)
        val backupRoot = File(filesDir, journal.backupName)
        if (!isKnownJournalPhase(journal.phase)
            || !isSafeTransactionPath(stagingRoot, filesDir, STAGING_PREFIX)
            || !isSafeTransactionPath(backupRoot, filesDir, BACKUP_PREFIX)
        ) {
            Log.e(TAG, "Ignoring unsafe import journal paths")
            clearJournal(journalFile)
            writeResult(resultFile, "failed", "", "unsafe_import_journal")
            return
        }

        try {
            if (targetRoot.exists()) {
                stagingRoot.deleteRecursively()
                backupRoot.deleteRecursively()
                clearJournal(journalFile)
                writeResult(resultFile, "completed", targetRoot.absolutePath, "recovered:${journal.treeUri}")
                return
            }

            if (backupRoot.exists() && backupRoot.renameTo(targetRoot)) {
                stagingRoot.deleteRecursively()
                clearJournal(journalFile)
                writeResult(resultFile, "completed", targetRoot.absolutePath, "recovered_previous:${journal.treeUri}")
                return
            }

            stagingRoot.deleteRecursively()
            backupRoot.deleteRecursively()
            clearJournal(journalFile)
            writeResult(resultFile, "failed", "", "recovered_empty:${journal.treeUri}")
        } catch (error: Throwable) {
            Log.e(TAG, "Unable to recover knowledge base import", error)
            writeResult(resultFile, "failed", "", "import_recovery_failed")
        }
    }

    private fun recoverOrphanedTransactions(filesDir: File, resultFile: File) {
        val targetRoot = File(filesDir, "Knowledge_Base")
        val stagingRoots = filesDir.listFiles { file -> file.name.startsWith(STAGING_PREFIX) } ?: emptyArray()
        stagingRoots.forEach { it.deleteRecursively() }
        val backupRoots = filesDir.listFiles { file -> file.name.startsWith(BACKUP_PREFIX) }
            ?.sortedByDescending { it.lastModified() }
            ?: emptyList()

        if (targetRoot.exists()) {
            backupRoots.forEach { it.deleteRecursively() }
            return
        }

        val backupRoot = backupRoots.firstOrNull()
        if (backupRoot != null && backupRoot.renameTo(targetRoot)) {
            backupRoots.drop(1).forEach { it.deleteRecursively() }
            writeResult(resultFile, "completed", targetRoot.absolutePath, "recovered_orphan")
        }
    }

    private fun isSafeTransactionPath(path: File, parent: File, prefix: String): Boolean {
        val parentPath = parent.canonicalFile.path + File.separator
        return path.name.startsWith(prefix)
            && path.name.indexOfAny(charArrayOf('/', '\\')) < 0
            && path.canonicalFile.path.startsWith(parentPath)
    }

    private fun isKnownJournalPhase(phase: String): Boolean = phase == "staging"
        || phase == "target-backed-up"
        || phase == "target-activated"

    private fun readJournal(file: File): ImportJournal? {
        if (!file.isFile) {
            return null
        }
        return try {
            val json = JSONObject(file.readText(Charsets.UTF_8))
            if (json.optInt("schema", -1) != JOURNAL_SCHEMA) {
                null
            } else {
                ImportJournal(
                    phase = json.optString("phase"),
                    stagingName = json.optString("stagingName"),
                    backupName = json.optString("backupName"),
                    treeUri = json.optString("treeUri"),
                )
            }
        } catch (error: Throwable) {
            Log.e(TAG, "Unable to parse import journal", error)
            null
        }
    }

    private fun writeJournal(file: File, journal: ImportJournal) {
        writeAtomicText(
            file,
            JSONObject()
                .put("schema", JOURNAL_SCHEMA)
                .put("phase", journal.phase)
                .put("stagingName", journal.stagingName)
                .put("backupName", journal.backupName)
                .put("treeUri", journal.treeUri)
                .toString(),
        )
    }

    private fun clearJournal(file: File) {
        file.delete()
        File(file.parentFile, "${file.name}.tmp").delete()
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
            writeAtomicText(
                file,
                JSONObject()
                    .put("status", status)
                    .put("path", path)
                    .put("detail", detail)
                    .toString(),
            )
        } catch (error: Throwable) {
            Log.e(TAG, "Unable to persist picker result", error)
        }
    }

    private fun writeAtomicText(file: File, content: String) {
        file.parentFile?.mkdirs()
        val temporary = File(file.parentFile, "${file.name}.tmp")
        FileOutputStream(temporary).use { output ->
            output.write(content.toByteArray(Charsets.UTF_8))
            output.fd.sync()
        }
        if (!temporary.renameTo(file)) {
            file.delete()
            if (!temporary.renameTo(file)) {
                throw IOException("Unable to atomically replace ${file.name}")
            }
        }
    }
}

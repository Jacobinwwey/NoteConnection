package __NOTE_PACKAGE__

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.util.Log

object PathmodeBridge {
    private const val TAG = "PathmodeBridge"
    const val EXTRA_PAYLOAD_JSON = "noteconnection.pathmode.payload_json"

    @JvmStatic
    fun openPathmode(context: Context, payloadJson: String?): Boolean {
        return try {
            val intent = Intent(context, PathmodeGodotActivity::class.java).apply {
                putExtra(EXTRA_PAYLOAD_JSON, payloadJson ?: "")
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                if (context !is Activity) {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }

            context.startActivity(intent)
            true
        } catch (err: Throwable) {
            Log.e(TAG, "Failed to open PathmodeGodotActivity", err)
            false
        }
    }
}


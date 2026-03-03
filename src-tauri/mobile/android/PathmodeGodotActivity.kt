package __NOTE_PACKAGE__

import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import org.godotengine.godot.GodotActivity

class PathmodeGodotActivity : GodotActivity() {
    companion object {
        private const val TAG = "PathmodeGodotActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUi()

        val payloadJson = intent?.getStringExtra(PathmodeBridge.EXTRA_PAYLOAD_JSON) ?: ""
        Log.i(TAG, "Received pathmode payload (chars=${payloadJson.length})")
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
    }

    override fun getCommandLine(): MutableList<String> {
        return mutableListOf(
            "--path",
            "/android_asset/path_mode"
        )
    }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
    }
}

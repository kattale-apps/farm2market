package com.farm2marketuganda.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        registerPlugin(CommunityBridge::class.java)
        handleDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        if (intent == null || intent.action != Intent.ACTION_VIEW) return

        val data: Uri = intent.data ?: return
        Log.d(TAG, "Deep link received: $data")

        if (data.scheme == "farm2market" && data.host == "community") {
            val communityId = data.lastPathSegment
            if (!communityId.isNullOrBlank()) {
                Log.d(TAG, "Community deep link detected: $communityId")
                CommunityConfigManager.getInstance(this).setSelectedCommunityId(communityId)
            }
        }
    }
}
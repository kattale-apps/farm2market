package com.farm2marketuganda.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register the CommunityBridge plugin
        registerPlugin(CommunityBridge.class);
        
        // Handle deep link if present
        handleDeepLink(getIntent());
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }
    
    /**
     * Handle deep link for community auto-join
     * Format: farm2market://community/{communityId}
     * 
     * This stores the community ID and lets the web layer handle the actual join logic
     */
    private void handleDeepLink(Intent intent) {
        if (intent == null) return;
        
        String action = intent.getAction();
        Uri data = intent.getData();
        
        if (Intent.ACTION_VIEW.equals(action) && data != null) {
            Log.d(TAG, "Deep link received: " + data.toString());
            
            // Parse farm2market://community/{communityId}
            if ("farm2market".equals(data.getScheme()) && "community".equals(data.getHost())) {
                String communityId = data.getLastPathSegment();
                if (communityId != null && !communityId.isEmpty()) {
                    Log.d(TAG, "Community deep link detected: " + communityId);
                    
                    // Store the community ID for the web layer to handle
                    CommunityConfigManager manager = CommunityConfigManager.getInstance(this);
                    manager.setSelectedCommunityId(communityId);
                    
                    // The web layer will detect this and handle auto-join
                }
            }
        }
    }
}

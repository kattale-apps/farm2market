package com.farm2marketuganda.app

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * CommunityBridge
 * 
 * Capacitor plugin bridge for community configuration.
 * Exposes native community config to the web layer via JavaScript.
 * 
 * JavaScript Usage:
 *   const { CommunityBridge } = Capacitor.Plugins;
 *   const result = await CommunityBridge.getCommunityId();
 *   console.log(result.communityId); // null or community ID
 */
@CapacitorPlugin(name = "CommunityBridge")
class CommunityBridge : Plugin() {
    
    private val TAG = "CommunityBridge"
    
    @PluginMethod
    fun getCommunityId(call: PluginCall) {
        try {
            val manager = CommunityConfigManager.getInstance(context)
            val communityId = manager.getEffectiveCommunityId()
            
            val result = JSObject()
            result.put("communityId", communityId)
            
            Log.d(TAG, "getCommunityId called, returning: $communityId")
            call.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting community ID", e)
            call.reject("Error getting community ID: ${e.message}")
        }
    }
    
    @PluginMethod
    fun getAutoJoinStatus(call: PluginCall) {
        try {
            val manager = CommunityConfigManager.getInstance(context)
            val hasAutoJoined = manager.hasAutoJoined()
            
            val result = JSObject()
            result.put("hasAutoJoined", hasAutoJoined)
            
            Log.d(TAG, "getAutoJoinStatus called, returning: $hasAutoJoined")
            call.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting auto-join status", e)
            call.reject("Error getting auto-join status: ${e.message}")
        }
    }
    
    @PluginMethod
    fun setAutoJoinComplete(call: PluginCall) {
        try {
            val manager = CommunityConfigManager.getInstance(context)
            manager.setAutoJoined()
            
            Log.d(TAG, "setAutoJoinComplete called")
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Error setting auto-join complete", e)
            call.reject("Error setting auto-join complete: ${e.message}")
        }
    }
    
    @PluginMethod
    fun setCommunityId(call: PluginCall) {
        try {
            val communityId = call.getString("communityId")
            val manager = CommunityConfigManager.getInstance(context)
            manager.setSelectedCommunityId(communityId)
            
            Log.d(TAG, "setCommunityId called with: $communityId")
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Error setting community ID", e)
            call.reject("Error setting community ID: ${e.message}")
        }
    }
}

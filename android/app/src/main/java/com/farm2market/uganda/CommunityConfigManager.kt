package com.farm2marketuganda.app

import android.content.Context
import android.content.SharedPreferences

/**
 * CommunityConfigManager
 * 
 * Manages community-specific configuration for branded APK builds.
 * Stores the selected/preconfigured community ID in SharedPreferences.
 * 
 * Design:
 * - Uses SharedPreferences (Android native local storage)
 * - Thread-safe singleton pattern
 * - Backward compatible: if no community set, returns null
 */
class CommunityConfigManager private constructor(context: Context) {
    
    private val prefs: SharedPreferences = context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    
    companion object {
        private const val PREFS_NAME = "farm2market_community_config"
        private const val KEY_COMMUNITY_ID = "community_id"
        private const val KEY_AUTO_JOINED = "auto_joined"
        
        @Volatile
        private var instance: CommunityConfigManager? = null
        
        fun getInstance(context: Context): CommunityConfigManager {
            return instance ?: synchronized(this) {
                instance ?: CommunityConfigManager(context).also { instance = it }
            }
        }
    }
    
    /**
     * Get the preconfigured community ID for this APK flavor
     * Returns null if this is a generic build or no community is configured
     */
    fun getPreconfiguredCommunityId(): String? {
        val buildConfigSlug = BuildConfig.DEFAULT_COMMUNITY_SLUG
        return if (buildConfigSlug.isBlank()) null else buildConfigSlug
    }
    
    /**
     * Get the currently selected community ID (from local storage)
     * Returns null if no community has been selected
     */
    fun getSelectedCommunityId(): String? {
        val stored = prefs.getString(KEY_COMMUNITY_ID, null)
        return if (stored.isNullOrBlank()) null else stored
    }
    
    /**
     * Save the selected community ID to local storage
     */
    fun setSelectedCommunityId(communityId: String?) {
        prefs.edit().apply {
            if (communityId.isNullOrBlank()) {
                remove(KEY_COMMUNITY_ID)
            } else {
                putString(KEY_COMMUNITY_ID, communityId)
            }
            apply()
        }
    }
    
    /**
     * Check if auto-join has already been performed
     */
    fun hasAutoJoined(): Boolean {
        return prefs.getBoolean(KEY_AUTO_JOINED, false)
    }
    
    /**
     * Mark that auto-join has been performed
     */
    fun setAutoJoined() {
        prefs.edit().putBoolean(KEY_AUTO_JOINED, true).apply()
    }
    
    /**
     * Clear all community configuration (useful for testing/reset)
     */
    fun clear() {
        prefs.edit().clear().apply()
    }
    
    /**
     * Get the effective community ID (preconfigured or selected)
     * Priority: preconfigured > selected
     */
    fun getEffectiveCommunityId(): String? {
        return getPreconfiguredCommunityId() ?: getSelectedCommunityId()
    }
}

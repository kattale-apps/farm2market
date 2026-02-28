"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface StoreManagerProps {
  storeId: Id<"stores">;
  storeName?: string;
}

export function StoreManager({ storeId, storeName = "Store" }: StoreManagerProps) {
  const [newLocation, setNewLocation] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch store with locations
  const store = useQuery(api.stores.getStoreWithLocations, { storeId });

  // Mutations
  const addLocation = useMutation(api.stores.addDeliveryLocation);
  const removeLocation = useMutation(api.stores.removeDeliveryLocation);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!newLocation.trim() || !newAddress.trim()) {
      setErrorMessage("Please fill in both location name and address");
      return;
    }

    setIsAdding(true);
    try {
      await addLocation({
        storeId,
        name: newLocation.trim(),
        address: newAddress.trim(),
      });
      setSuccessMessage("✓ Delivery location added successfully");
      setNewLocation("");
      setNewAddress("");

      // Clear message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to add delivery location");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveLocation = async (locationId: string) => {
    if (!confirm("Remove this delivery location?")) return;

    try {
      await removeLocation({ storeId, locationId });
      setSuccessMessage("✓ Delivery location removed");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to remove delivery location");
    }
  };

  if (store === undefined) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-900 font-semibold">Store not found</p>
      </div>
    );
  }

  const deliveryLocations = store.deliveryLocations || [];

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6">
        <h2 className="text-2xl font-bold text-white mb-1">🏪 {storeName}</h2>
        <p className="text-green-100 text-sm">
          Manage delivery locations for this store
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Messages */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-900 text-sm font-medium">{errorMessage}</p>
          </div>
        )}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-900 text-sm font-medium">{successMessage}</p>
          </div>
        )}

        {/* Add Location Form */}
        <form onSubmit={handleAddLocation} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              ➕ Location Name
            </label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="e.g., Downtown Market, Warehouse A"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={isAdding}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Address
            </label>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="e.g., Main Street, Kampala"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={isAdding}
            />
          </div>

          <button
            type="submit"
            disabled={isAdding || !newLocation.trim() || !newAddress.trim()}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed min-h-12"
          >
            {isAdding ? "Adding..." : "Add Delivery Location"}
          </button>
        </form>

        {/* Existing Locations */}
        <div className="border-t-2 border-gray-200 pt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Current Locations ({deliveryLocations.length})
          </h3>

          {deliveryLocations.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-gray-500 text-sm">
                No delivery locations added yet. Add one using the form above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveryLocations.map((location) => (
                <div
                  key={location.locationId}
                  className="bg-gray-50 rounded-lg p-4 flex items-start justify-between gap-4 hover:bg-gray-100 transition"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 line-clamp-1">
                      {location.name}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-1">
                      {location.address}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Added {new Date(location.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleRemoveLocation(location.locationId)}
                    className="flex-shrink-0 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg transition min-h-10 flex items-center"
                    type="button"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>💡 Tip:</strong> Add multiple delivery locations so customers can choose where to pick up their orders.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Seed Ugandan Produce Options
 * 
 * Idempotent mutation that populates produceOptions with ~70 Ugandan market items.
 * Skips any items whose `value` already exists. Admin-only.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyAdminRole } from "./auth";
import { getUgandaTime } from "./utils";

const PRODUCE_ITEMS: { label: string; value: string; icon: string; category: string }[] = [
  // Grains & Cereals
  { label: "Maize", value: "Maize", icon: "🌽", category: "Grains & Cereals" },
  { label: "Rice", value: "Rice", icon: "🍚", category: "Grains & Cereals" },
  { label: "Millet", value: "Millet", icon: "🌾", category: "Grains & Cereals" },
  { label: "Sorghum", value: "Sorghum", icon: "🌾", category: "Grains & Cereals" },
  { label: "Wheat", value: "Wheat", icon: "🌾", category: "Grains & Cereals" },

  // Legumes & Pulses
  { label: "Beans", value: "Beans", icon: "🫘", category: "Legumes & Pulses" },
  { label: "Groundnuts", value: "Groundnuts", icon: "🥜", category: "Legumes & Pulses" },
  { label: "Soybeans", value: "Soybeans", icon: "🫘", category: "Legumes & Pulses" },
  { label: "Cowpeas", value: "Cowpeas", icon: "🫘", category: "Legumes & Pulses" },
  { label: "Pigeon Peas", value: "Pigeon Peas", icon: "🫘", category: "Legumes & Pulses" },
  { label: "Green Grams", value: "Green Grams", icon: "🫛", category: "Legumes & Pulses" },
  { label: "Lentils", value: "Lentils", icon: "🫘", category: "Legumes & Pulses" },

  // Root Crops & Tubers
  { label: "Cassava", value: "Cassava", icon: "🥔", category: "Root Crops & Tubers" },
  { label: "Sweet Potatoes", value: "Sweet Potatoes", icon: "🍠", category: "Root Crops & Tubers" },
  { label: "Irish Potatoes", value: "Irish Potatoes", icon: "🥔", category: "Root Crops & Tubers" },
  { label: "Yams", value: "Yams", icon: "🍠", category: "Root Crops & Tubers" },
  { label: "Arrowroots", value: "Arrowroots", icon: "🥔", category: "Root Crops & Tubers" },

  // Fruits
  { label: "Bananas (Matooke)", value: "Bananas (Matooke)", icon: "🍌", category: "Fruits" },
  { label: "Bananas (Sweet)", value: "Bananas (Sweet)", icon: "🍌", category: "Fruits" },
  { label: "Mangoes", value: "Mangoes", icon: "🥭", category: "Fruits" },
  { label: "Pineapples", value: "Pineapples", icon: "🍍", category: "Fruits" },
  { label: "Passion Fruit", value: "Passion Fruit", icon: "🍈", category: "Fruits" },
  { label: "Watermelon", value: "Watermelon", icon: "🍉", category: "Fruits" },
  { label: "Oranges", value: "Oranges", icon: "🍊", category: "Fruits" },
  { label: "Avocados", value: "Avocados", icon: "🥑", category: "Fruits" },
  { label: "Jackfruit", value: "Jackfruit", icon: "🍈", category: "Fruits" },
  { label: "Pawpaw (Papaya)", value: "Pawpaw (Papaya)", icon: "🍈", category: "Fruits" },
  { label: "Guavas", value: "Guavas", icon: "🍐", category: "Fruits" },

  // Vegetables
  { label: "Tomatoes", value: "Tomatoes", icon: "🍅", category: "Vegetables" },
  { label: "Onions", value: "Onions", icon: "🧅", category: "Vegetables" },
  { label: "Cabbage", value: "Cabbage", icon: "🥬", category: "Vegetables" },
  { label: "Eggplant", value: "Eggplant", icon: "🍆", category: "Vegetables" },
  { label: "Green Peppers", value: "Green Peppers", icon: "🫑", category: "Vegetables" },
  { label: "Hot Peppers", value: "Hot Peppers", icon: "🌶️", category: "Vegetables" },
  { label: "Sukuma Wiki (Kale)", value: "Sukuma Wiki (Kale)", icon: "🥬", category: "Vegetables" },
  { label: "Spinach", value: "Spinach", icon: "🥬", category: "Vegetables" },
  { label: "Carrots", value: "Carrots", icon: "🥕", category: "Vegetables" },
  { label: "Pumpkins", value: "Pumpkins", icon: "🎃", category: "Vegetables" },
  { label: "Okra", value: "Okra", icon: "🌿", category: "Vegetables" },
  { label: "Mushrooms", value: "Mushrooms", icon: "🍄", category: "Vegetables" },

  // Spices & Herbs
  { label: "Vanilla", value: "Vanilla", icon: "🌿", category: "Spices & Herbs" },
  { label: "Ginger", value: "Ginger", icon: "🫚", category: "Spices & Herbs" },
  { label: "Garlic", value: "Garlic", icon: "🧄", category: "Spices & Herbs" },
  { label: "Turmeric", value: "Turmeric", icon: "🟡", category: "Spices & Herbs" },
  { label: "Chili Powder", value: "Chili Powder", icon: "🌶️", category: "Spices & Herbs" },
  { label: "Cinnamon", value: "Cinnamon", icon: "🟤", category: "Spices & Herbs" },

  // Oils & Oil Seeds
  { label: "Sunflower Seeds", value: "Sunflower Seeds", icon: "🌻", category: "Oils & Oil Seeds" },
  { label: "Sesame (Simsim)", value: "Sesame (Simsim)", icon: "🌰", category: "Oils & Oil Seeds" },
  { label: "Palm Oil", value: "Palm Oil", icon: "🫒", category: "Oils & Oil Seeds" },
  { label: "Shea Nuts", value: "Shea Nuts", icon: "🥜", category: "Oils & Oil Seeds" },

  // Meat & Poultry
  { label: "Beef", value: "Beef", icon: "🥩", category: "Meat & Poultry" },
  { label: "Goat Meat", value: "Goat Meat", icon: "🐐", category: "Meat & Poultry" },
  { label: "Chicken", value: "Chicken", icon: "🐔", category: "Meat & Poultry" },
  { label: "Pork", value: "Pork", icon: "🐷", category: "Meat & Poultry" },
  { label: "Turkey", value: "Turkey", icon: "🦃", category: "Meat & Poultry" },
  { label: "Duck", value: "Duck", icon: "🦆", category: "Meat & Poultry" },
  { label: "Eggs", value: "Eggs", icon: "🥚", category: "Meat & Poultry" },

  // Fish & Seafood
  { label: "Tilapia", value: "Tilapia", icon: "🐟", category: "Fish & Seafood" },
  { label: "Nile Perch", value: "Nile Perch", icon: "🐟", category: "Fish & Seafood" },
  { label: "Mukene (Silver Fish)", value: "Mukene (Silver Fish)", icon: "🐟", category: "Fish & Seafood" },
  { label: "Catfish", value: "Catfish", icon: "🐟", category: "Fish & Seafood" },
  { label: "Dried Fish", value: "Dried Fish", icon: "🐟", category: "Fish & Seafood" },

  // Dairy
  { label: "Fresh Milk", value: "Fresh Milk", icon: "🥛", category: "Dairy" },
  { label: "Ghee", value: "Ghee", icon: "🧈", category: "Dairy" },
  { label: "Yogurt", value: "Yogurt", icon: "🥛", category: "Dairy" },

  // Cash Crops & Processed
  { label: "Coffee", value: "Coffee", icon: "☕", category: "Cash Crops & Processed" },
  { label: "Tea", value: "Tea", icon: "🍵", category: "Cash Crops & Processed" },
  { label: "Cotton", value: "Cotton", icon: "🏵️", category: "Cash Crops & Processed" },
  { label: "Tobacco", value: "Tobacco", icon: "🍃", category: "Cash Crops & Processed" },
  { label: "Sugarcane", value: "Sugarcane", icon: "🎋", category: "Cash Crops & Processed" },
  { label: "Cocoa", value: "Cocoa", icon: "🟤", category: "Cash Crops & Processed" },
  { label: "Honey", value: "Honey", icon: "🍯", category: "Cash Crops & Processed" },
  { label: "Cassava Flour", value: "Cassava Flour", icon: "🌾", category: "Cash Crops & Processed" },
  { label: "Maize Flour", value: "Maize Flour", icon: "🌽", category: "Cash Crops & Processed" },
];

export const seedProduce = mutation({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can seed produce data");
    }

    // Load all existing produce options to check for duplicates
    const existing = await ctx.db.query("produceOptions").collect();
    const existingValues = new Set(existing.map((o) => o.value));

    let created = 0;
    let skipped = 0;
    const now = getUgandaTime();

    for (let i = 0; i < PRODUCE_ITEMS.length; i++) {
      const item = PRODUCE_ITEMS[i];
      if (existingValues.has(item.value)) {
        skipped++;
        continue;
      }

      await ctx.db.insert("produceOptions", {
        label: item.label,
        value: item.value,
        icon: item.icon,
        category: item.category,
        order: existing.length + created + 1,
        active: true,
        createdAt: now,
        createdBy: args.adminId,
      });
      created++;
    }

    return { created, skipped, total: PRODUCE_ITEMS.length };
  },
});

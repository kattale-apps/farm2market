"use client";

import React from "react";
import { Section2Crop } from "./Section2Crop";

interface Props {
  data?: any;
  onUpdate: (data: any) => void;
}

export function Section2_10_WoodyForest({ data, onUpdate }: Props) {
  return <Section2Crop title="2.10 Planted Woody Forest" data={data} onUpdate={onUpdate} />;
}
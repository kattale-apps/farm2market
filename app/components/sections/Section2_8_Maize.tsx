"use client";

import React from "react";
import { Section2Crop } from "./Section2Crop";

interface Props {
  data?: any;
  onUpdate: (data: any) => void;
}

export function Section2_8_Maize({ data, onUpdate }: Props) {
  return <Section2Crop title="2.8 Maize" data={data} onUpdate={onUpdate} />;
}
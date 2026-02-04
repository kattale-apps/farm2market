"use client";

import React from "react";
import { Section2Crop } from "./Section2Crop";

interface Props {
  data?: any;
  onUpdate: (data: any) => void;
}

export function Section2_7_Banana({ data, onUpdate }: Props) {
  return <Section2Crop title="2.7 Banana Plantation" data={data} onUpdate={onUpdate} />;
}
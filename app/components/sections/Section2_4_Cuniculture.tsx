"use client";

import React from "react";
import { Section2Livestock } from "./Section2Livestock";

interface Props {
  data?: any;
  onUpdate: (data: any) => void;
}

export function Section2_4_Cuniculture({ data, onUpdate }: Props) {
  return <Section2Livestock title="2.4 Cuniculture / Rabbitry" data={data} onUpdate={onUpdate} />;
}
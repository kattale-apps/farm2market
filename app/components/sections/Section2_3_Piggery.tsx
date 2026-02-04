"use client";

import React from "react";
import { Section2Livestock } from "./Section2Livestock";

interface Props {
  data?: any;
  onUpdate: (data: any) => void;
}

export function Section2_3_Piggery({ data, onUpdate }: Props) {
  return <Section2Livestock title="2.3 Piggery Farming" data={data} onUpdate={onUpdate} />;
}
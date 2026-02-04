"use client";

import React from "react";
import { Section2Livestock } from "./Section2Livestock";

interface Props {
  data?: any;
  onUpdate: (data: any) => void;
}

export function Section2_1_Dairy({ data, onUpdate }: Props) {
  return <Section2Livestock title="2.1 Dairy Farming" data={data} onUpdate={onUpdate} />;
}
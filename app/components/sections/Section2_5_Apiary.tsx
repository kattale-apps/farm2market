"use client";

import React from "react";
import { Section2Apiary } from "./Section2Apiary";

interface Props {
  data?: any;
  onUpdate: (data: any) => void;
}

export function Section2_5_Apiary({ data, onUpdate }: Props) {
  return <Section2Apiary data={data} onUpdate={onUpdate} />;
}
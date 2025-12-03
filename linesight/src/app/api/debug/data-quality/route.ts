import { NextResponse } from "next/server";

import { getDataQualitySnapshot } from "@/server/dataQuality/getDataQualitySnapshot";

export async function GET() {
  try {
    const snapshot = await getDataQualitySnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Data quality snapshot failed", error);
    return NextResponse.json({ error: "Failed to compute data quality snapshot" }, { status: 500 });
  }
}

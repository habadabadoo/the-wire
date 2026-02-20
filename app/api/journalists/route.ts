// app/api/journalists/route.ts
import { NextResponse } from "next/server";
import { getJournalists } from "@/lib/journalist-tracker";

export async function GET() {
  const journalists = getJournalists();
  return NextResponse.json({ journalists });
}

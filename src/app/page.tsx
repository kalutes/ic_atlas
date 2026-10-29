import { getStore } from "@/lib/db";
import Collection from "@/components/collection";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default function Home() {
  return <Collection initialCards={getStore().list()} />;
}

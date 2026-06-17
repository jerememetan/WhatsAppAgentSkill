import { Dashboard } from "@/components/Dashboard";
import { readStore } from "@/lib/store";

export default async function Home() {
  const data = await readStore();
  return <Dashboard initialData={data} />;
}

import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import type { Contact, StoreData } from "./types";

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "store.json");

const seedContacts: Contact[] = [
  {
    contactId: "contact_001",
    name: "Alex Tan",
    companyName: "Acme Sdn Bhd",
    whatsapp: "+6591111111",
    email: "alex@example.com",
    status: "active",
    doNotContact: false,
    notes: "Interested in workflow automation"
  },
  {
    contactId: "contact_002",
    name: "Priya Raman",
    companyName: "Northstar Manufacturing",
    whatsapp: "+6592222222",
    email: "priya@example.com",
    status: "active",
    doNotContact: false,
    notes: "Asked about lead follow-up tools"
  },
  {
    contactId: "contact_003",
    name: "Jordan Lee",
    companyName: "Do Not Contact Co",
    whatsapp: "+6593333333",
    email: "jordan@example.com",
    status: "active",
    doNotContact: true,
    notes: "Opted out of sales outreach"
  }
];

export function emptyStore(): StoreData {
  return {
    contacts: seedContacts,
    draftReviews: [],
    sendPlans: [],
    authorizations: [],
    threads: [],
    followUps: []
  };
}

export async function readStore(): Promise<StoreData> {
  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      ...emptyStore(),
      ...parsed,
      contacts: parsed.contacts?.length ? parsed.contacts : seedContacts
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    const initial = emptyStore();
    await writeStore(initial);
    return initial;
  }
}

export async function writeStore(data: StoreData): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, storePath);
}

export async function updateStore<T>(mutate: (data: StoreData) => T | Promise<T>): Promise<T> {
  const data = await readStore();
  const result = await mutate(data);
  await writeStore(data);
  return result;
}

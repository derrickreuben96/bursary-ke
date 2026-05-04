import { useEffect, useState } from "react";

export interface KenyaWard {
  name: string;
}
export interface KenyaCounty {
  name: string;
  wards: KenyaWard[];
}
export interface KenyaLocations {
  counties: KenyaCounty[];
}

let cache: KenyaLocations | null = null;
let inflight: Promise<KenyaLocations> | null = null;

export async function loadKenyaLocations(): Promise<KenyaLocations> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/kenya_locations.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load kenya_locations.json (${r.status})`);
      return r.json() as Promise<KenyaLocations>;
    })
    .then((data) => {
      cache = data;
      inflight = null;
      return data;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  return inflight;
}

export function getCachedKenyaLocations(): KenyaLocations | null {
  return cache;
}

export function useKenyaLocations() {
  const [data, setData] = useState<KenyaLocations | null>(cache);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(!cache);

  useEffect(() => {
    if (cache) {
      setData(cache);
      setLoading(false);
      return;
    }
    let active = true;
    loadKenyaLocations()
      .then((d) => {
        if (active) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const counties = data?.counties ?? [];
  const countyNames = counties.map((c) => c.name);
  const wardsByCounty: Record<string, string[]> = {};
  for (const c of counties) wardsByCounty[c.name] = c.wards.map((w) => w.name);

  return { data, counties, countyNames, wardsByCounty, loading, error };
}

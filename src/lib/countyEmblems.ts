import nairobiEmblem from "@/assets/counties/nairobi.png";
import mombasaEmblem from "@/assets/counties/mombasa.png";
import kisumuEmblem from "@/assets/counties/kisumu.png";
import nakuruEmblem from "@/assets/counties/nakuru.png";
import kiambuEmblem from "@/assets/counties/kiambu.png";
import machakosEmblem from "@/assets/counties/machakos.png";
import uasinGishuEmblem from "@/assets/counties/uasin-gishu.png";
import kilifiEmblem from "@/assets/counties/kilifi.png";
import nyeriEmblem from "@/assets/counties/nyeri.png";

const countyEmblems: Record<string, string> = {
  "Nairobi": nairobiEmblem,
  "Mombasa": mombasaEmblem,
  "Kisumu": kisumuEmblem,
  "Nakuru": nakuruEmblem,
  "Kiambu": kiambuEmblem,
  "Machakos": machakosEmblem,
  "Uasin Gishu": uasinGishuEmblem,
  "Kilifi": kilifiEmblem,
  "Nyeri": nyeriEmblem,
};

export function getCountyEmblem(county: string): string | undefined {
  return countyEmblems[county];
}

export default countyEmblems;

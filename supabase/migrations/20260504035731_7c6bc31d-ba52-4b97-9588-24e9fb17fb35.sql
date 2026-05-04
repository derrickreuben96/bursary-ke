CREATE TABLE IF NOT EXISTS public.kenya_locations (
  county text NOT NULL,
  ward text NOT NULL,
  PRIMARY KEY (county, ward)
);

ALTER TABLE public.kenya_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read kenya_locations" ON public.kenya_locations;
CREATE POLICY "Anyone can read kenya_locations"
  ON public.kenya_locations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins can modify kenya_locations" ON public.kenya_locations;
CREATE POLICY "Only admins can modify kenya_locations"
  ON public.kenya_locations FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.kenya_locations (county, ward) VALUES ('Baringo','Tiaty'),('Baringo','Baringo North'),('Baringo','Baringo Central'),('Baringo','Baringo South'),('Baringo','Mogotio'),('Baringo','Eldama Ravine'),('Bomet','Sotik'),('Bomet','Chepalungu'),('Bomet','Bomet East'),('Bomet','Bomet Central'),('Bomet','Konoin'),('Bungoma','Mount Elgon'),('Bungoma','Sirisia'),('Bungoma','Kabuchai'),('Bungoma','Bumula'),('Bungoma','Kanduyi'),('Bungoma','Webuye East'),('Bungoma','Webuye West'),('Bungoma','Kimilili'),('Bungoma','Tongaren'),('Busia','Teso North'),('Busia','Teso South'),('Busia','Nambale'),('Busia','Matayos'),('Busia','Butula'),('Busia','Funyula'),('Busia','Budalangi'),('Elgeyo-Marakwet','Marakwet East'),('Elgeyo-Marakwet','Marakwet West'),('Elgeyo-Marakwet','Keiyo North'),('Elgeyo-Marakwet','Keiyo South'),('Embu','Manyatta'),('Embu','Runyenjes'),('Embu','Mbeere South'),('Embu','Mbeere North'),('Garissa','Garissa Township'),('Garissa','Balambala'),('Garissa','Lagdera'),('Garissa','Dadaab'),('Garissa','Fafi'),('Garissa','Ijara'),('Homa Bay','Kasipul'),('Homa Bay','Kabondo Kasipul'),('Homa Bay','Karachuonyo'),('Homa Bay','Rangwe'),('Homa Bay','Homa Bay Town'),('Homa Bay','Ndhiwa'),('Homa Bay','Suba North'),('Homa Bay','Suba South'),('Isiolo','Isiolo North'),('Isiolo','Isiolo South'),('Kajiado','Kajiado North'),('Kajiado','Kajiado Central'),('Kajiado','Kajiado East'),('Kajiado','Kajiado West'),('Kajiado','Kajiado South'),('Kakamega','Lugari'),('Kakamega','Likuyani'),('Kakamega','Malava'),('Kakamega','Lurambi'),('Kakamega','Navakholo'),('Kakamega','Mumias West'),('Kakamega','Mumias East'),('Kakamega','Matungu'),('Kakamega','Butere'),('Kakamega','Khwisero'),('Kakamega','Shinyalu'),('Kakamega','Ikolomani'),('Kericho','Kipkelion East'),('Kericho','Kipkelion West'),('Kericho','Ainamoi'),('Kericho','Bureti'),('Kericho','Belgut'),('Kericho','Sigowet/Soin'),('Kiambu','Thika Town'),('Kiambu','Ruiru'),('Kiambu','Juja'),('Kiambu','Gatundu South'),('Kiambu','Gatundu North'),('Kiambu','Githunguri'),('Kiambu','Kiambu'),('Kiambu','Kiambaa'),('Kiambu','Kabete'),('Kiambu','Kikuyu'),('Kiambu','Limuru'),('Kiambu','Lari'),('Kilifi','Kilifi North'),('Kilifi','Kilifi South'),('Kilifi','Kaloleni'),('Kilifi','Rabai'),('Kilifi','Ganze'),('Kilifi','Malindi'),('Kilifi','Magarini'),('Kirinyaga','Mwea'),('Kirinyaga','Gichugu'),('Kirinyaga','Ndia'),('Kirinyaga','Kirinyaga Central'),('Kisii','Bonchari'),('Kisii','South Mugirango'),('Kisii','Bomachoge Borabu'),('Kisii','Bobasi'),('Kisii','Bomachoge Chache'),('Kisii','Nyaribari Masaba'),('Kisii','Nyaribari Chache'),('Kisii','Kitutu Chache North'),('Kisii','Kitutu Chache South'),('Kisumu','Kisumu East'),('Kisumu','Kisumu West'),('Kisumu','Kisumu Central'),('Kisumu','Seme'),('Kisumu','Nyando'),('Kisumu','Muhoroni'),('Kisumu','Nyakach'),('Kitui','Mwingi North'),('Kitui','Mwingi West'),('Kitui','Mwingi Central'),('Kitui','Kitui West'),('Kitui','Kitui Rural'),('Kitui','Kitui Central'),('Kitui','Kitui East'),('Kitui','Kitui South'),('Kwale','Msambweni'),('Kwale','Lungalunga'),('Kwale','Matuga'),('Kwale','Kinango'),('Laikipia','Laikipia West'),('Laikipia','Laikipia East'),('Laikipia','Laikipia North'),('Lamu','Lamu East'),('Lamu','Lamu West'),('Machakos','Machakos Town'),('Machakos','Mavoko'),('Machakos','Masinga'),('Machakos','Yatta'),('Machakos','Kangundo'),('Machakos','Matungulu'),('Machakos','Kathiani'),('Machakos','Mwala'),('Makueni','Mbooni'),('Makueni','Kilome'),('Makueni','Kaiti'),('Makueni','Makueni'),('Makueni','Kibwezi West'),('Makueni','Kibwezi East'),('Mandera','Mandera West'),('Mandera','Banissa'),('Mandera','Mandera North'),('Mandera','Mandera South'),('Mandera','Mandera East'),('Mandera','Lafey'),('Marsabit','Moyale'),('Marsabit','North Horr'),('Marsabit','Saku'),('Marsabit','Laisamis'),('Meru','Igembe South'),('Meru','Igembe Central'),('Meru','Igembe North'),('Meru','Tigania West'),('Meru','Tigania East'),('Meru','North Imenti'),('Meru','Buuri'),('Meru','Central Imenti'),('Meru','South Imenti'),('Migori','Rongo'),('Migori','Awendo'),('Migori','Suna East'),('Migori','Suna West'),('Migori','Uriri'),('Migori','Nyatike'),('Migori','Kuria West'),('Migori','Kuria East'),('Mombasa','Changamwe'),('Mombasa','Jomvu'),('Mombasa','Kisauni'),('Mombasa','Nyali'),('Mombasa','Likoni'),('Mombasa','Mvita'),('Murang''a','Kangema'),('Murang''a','Mathioya'),('Murang''a','Kiharu'),('Murang''a','Kigumo'),('Murang''a','Maragwa'),('Murang''a','Kandara'),('Murang''a','Gatanga'),('Nairobi','Westlands'),('Nairobi','Dagoretti North'),('Nairobi','Dagoretti South'),('Nairobi','Langata'),('Nairobi','Kibra'),('Nairobi','Roysambu'),('Nairobi','Kasarani'),('Nairobi','Ruaraka'),('Nairobi','Embakasi South'),('Nairobi','Embakasi North'),('Nairobi','Embakasi Central'),('Nairobi','Embakasi East'),('Nairobi','Embakasi West'),('Nairobi','Makadara'),('Nairobi','Kamukunji'),('Nairobi','Starehe'),('Nairobi','Mathare'),('Nakuru','Nakuru Town East'),('Nakuru','Nakuru Town West'),('Nakuru','Naivasha'),('Nakuru','Gilgil'),('Nakuru','Subukia'),('Nakuru','Rongai'),('Nakuru','Bahati'),('Nakuru','Molo'),('Nakuru','Njoro'),('Nakuru','Kuresoi North'),('Nakuru','Kuresoi South'),('Nandi','Tinderet'),('Nandi','Aldai'),('Nandi','Nandi Hills'),('Nandi','Chesumei'),('Nandi','Emgwen'),('Nandi','Mosop'),('Narok','Kilgoris'),('Narok','Emurua Dikirr'),('Narok','Narok North'),('Narok','Narok East'),('Narok','Narok South'),('Narok','Narok West'),('Nyamira','Kitutu Masaba'),('Nyamira','West Mugirango'),('Nyamira','North Mugirango'),('Nyamira','Borabu'),('Nyandarua','Kinangop'),('Nyandarua','Kipipiri'),('Nyandarua','Ol Kalou'),('Nyandarua','Ol Jorok'),('Nyandarua','Ndaragwa'),('Nyeri','Tetu'),('Nyeri','Kieni'),('Nyeri','Mathira'),('Nyeri','Othaya'),('Nyeri','Mukurweini'),('Nyeri','Nyeri Town'),('Samburu','Samburu West'),('Samburu','Samburu North'),('Samburu','Samburu East'),('Siaya','Ugenya'),('Siaya','Ugunja'),('Siaya','Alego Usonga'),('Siaya','Gem'),('Siaya','Bondo'),('Siaya','Rarieda'),('Taita-Taveta','Taveta'),('Taita-Taveta','Wundanyi'),('Taita-Taveta','Mwatate'),('Taita-Taveta','Voi'),('Tana River','Garsen'),('Tana River','Galole'),('Tana River','Bura'),('Tharaka-Nithi','Maara'),('Tharaka-Nithi','Chuka/Igambang''ombe'),('Tharaka-Nithi','Tharaka'),('Trans-Nzoia','Kwanza'),('Trans-Nzoia','Endebess'),('Trans-Nzoia','Saboti'),('Trans-Nzoia','Kiminini'),('Trans-Nzoia','Cherangany'),('Turkana','Turkana North'),('Turkana','Turkana West'),('Turkana','Turkana Central'),('Turkana','Loima'),('Turkana','Turkana South'),('Turkana','Turkana East'),('Uasin Gishu','Soy'),('Uasin Gishu','Turbo'),('Uasin Gishu','Moiben'),('Uasin Gishu','Ainabkoi'),('Uasin Gishu','Kapseret'),('Uasin Gishu','Kesses'),('Vihiga','Vihiga'),('Vihiga','Sabatia'),('Vihiga','Hamisi'),('Vihiga','Luanda'),('Vihiga','Emuhaya'),('Wajir','Wajir North'),('Wajir','Wajir East'),('Wajir','Tarbaj'),('Wajir','Wajir West'),('Wajir','Eldas'),('Wajir','Wajir South'),('West Pokot','Kapenguria'),('West Pokot','Sigor'),('West Pokot','Kacheliba'),('West Pokot','Pokot South')
ON CONFLICT (county, ward) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_advert_county_ward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF NEW.county IS NULL OR length(trim(NEW.county)) = 0 THEN
    RAISE EXCEPTION 'County is required';
  END IF;
  IF NEW.ward IS NULL OR length(trim(NEW.ward)) = 0 THEN
    RAISE EXCEPTION 'Ward is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kenya_locations
    WHERE county = NEW.county AND ward = NEW.ward
  ) THEN
    RAISE EXCEPTION 'Invalid location: ward "%" does not belong to county "%"', NEW.ward, NEW.county;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS validate_advert_county_ward_trigger ON public.bursary_adverts;
CREATE TRIGGER validate_advert_county_ward_trigger
  BEFORE INSERT OR UPDATE OF county, ward ON public.bursary_adverts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_advert_county_ward();
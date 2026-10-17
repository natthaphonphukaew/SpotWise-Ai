"""Location sanity checks for Overture places.

Most Overture places here come only from Meta (Facebook pages), whose pins follow whatever
address the page owner typed. Some land in Bangmod although the place is elsewhere
(e.g. a Sukhumvit school). Each rule returns a rejection reason or None; every rejection is
written to cache/rejected.csv so it can be audited.
"""
import re

import geopandas as gpd
import pandas as pd

from config import METRIC_CRS

AREA_POSTCODES = {"10140", "10150", "10130"}  # Thung Khru / Rat Burana, Chom Thong / Bang Khun Thian, Phra Pradaeng

# Names that tie a record to our area are strong local evidence.
LOCAL_NAME = re.compile(
    r"มจธ|kmutt|พระจอมเก(ล้)?าธนบุรี|พระจอมเกล้า ธนบุรี|พระเจ้าเกล้าธนบุรี|บางมด|bang ?mod|ประชาอุทิศ|pracha ?u?thit|"
    r"พุทธบูชา|phutthabucha|ทุ่งครุ|thung ?khr?u|ราษฎร์บูรณะ|rat ?burana|สุขสวัสดิ์|suk ?sawat|"
    r"จอมทอง|บางปะกอก|บางขุนเทียน|พระประแดง|ธนบุรีรมย์|สวนธน|suan ?thon",
    re.I,
)

ALLOWED_LOCALITY = re.compile(
    r"^(เขต|อำเภอ|khet |amphoe )?\s*(กรุงเทพ.*|bangkok.*|ทุ่งครุ่?|thung ?khu?ru.*|ราษฎร์บูรณะ|rat ?burana|"
    r"kw\.ratburana.*|จอมทอง|chom ?thong|บางขุนเทียน|bang ?khun ?thian|พระประแดง|phra ?pradaeng|"
    r"bang ?mot|บางมด|สมุทรปราการ|samut ?prakan)$",
    re.I,
)

# Other parts of Bangkok / Thailand. Only applied to non-food places: Thai food shops are
# routinely named after famous areas ("ข้าวขาหมูเยาวราช") without being there.
ELSEWHERE_NAME = re.compile(
    r"สยามพารากอน|สยามสแควร์|siam ?paragon|siam ?square|siamparagon|ปทุมวัน|pathumwan|สุขุมวิท|sukhumvit|"
    r"สีลม|silom|สาทร|sathorn|รัชดา|ratchada|ลาดพร้าว|lat ?phrao|ladprao|บางนา|bang ?na\b|อโศก|asoke|ทองหล่อ|"
    r"thonglor|thong ?lo|เอกมัย|ekkamai|จตุจักร|chatuchak|พญาไท|phaya ?thai|phyathai|ดอนเมือง|don ?mueang|"
    r"รามคำแหง|ramkhamhaeng|ประเวศ|prawet|คลองเตย|khlong ?toei|ห้วยขวาง|huai ?khwang|ดินแดง|din ?daeng|"
    r"บางรัก|bang ?rak|บางเขน|bang ?khen|บางกะปิ|bang ?kapi|มีนบุรี|min ?buri|ลาดกระบัง|lat ?krabang|"
    r"หนองจอก|nong ?chok|บางซื่อ|bang ?sue|หลักสี่|lak ?si|บางกอกน้อย|bangkok ?noi|ตลิ่งชัน|taling ?chan|"
    r"รังสิต|rangsit|นนทบุรี|nonthaburi|ปากเกร็ด|pak ?kret|เชียงใหม่|chiang ?mai|ภูเก็ต|phuket|พัทยา|pattaya|"
    r"หัวหิน|hua ?hin|ขอนแก่น|khon ?kaen|นครราชสีมา|korat|ชลบุรี|chonburi|ระยอง|rayong|หาดใหญ่|hat ?yai|"
    r"อุดรธานี|udon|อุบลราชธานี|ubon|เขาค้อ|khao ?kho|เขาใหญ่|khao ?yai|เกาะสมุย|samui|เกาะช้าง|koh ?chang|"
    r"กาญจนบุรี|kanchanaburi|กระบี่|krabi|เชียงราย|chiang ?rai|"
    # provinces (ambiguous short ones like ตาก/เลย/แพร่ only with จ./จังหวัด)
    r"กาฬสินธุ์|กำแพงเพชร|จันทบุรี|ฉะเชิงเทรา|ชัยนาท|ชัยภูมิ|ตราด|นครนายก|นครปฐม|นครพนม|"
    r"นครศรีธรรมราช|นครสวรรค์|นราธิวาส|บึงกาฬ|บุรีรัมย์|ปทุมธานี|ประจวบคีรีขันธ์|ปราจีนบุรี|ปัตตานี|"
    r"พระนครศรีอยุธยา|พะเยา|พังงา|พัทลุง|พิจิตร|พิษณุโลก|เพชรบุรี|เพชรบูรณ์|มหาสารคาม|มุกดาหาร|"
    r"แม่ฮ่องสอน|ยโสธร|ยะลา|ร้อยเอ็ด|ระนอง|ราชบุรี|ลพบุรี|ลำปาง|ลำพูน|ศรีสะเกษ|สกลนคร|สงขลา|สตูล|"
    r"สมุทรสงคราม|สมุทรสาคร|สระแก้ว|สระบุรี|สิงห์บุรี|สุโขทัย|สุพรรณบุรี|สุราษฎร์ธานี|สุรินทร์|หนองคาย|"
    r"หนองบัวลำภู|อ่างทอง|อำนาจเจริญ|อุตรดิตถ์|อุทัยธานี|"
    r"(จ\.|จังหวัด) ?(ตาก|เลย|แพร่|น่าน|ตรัง|ชุมพร|อยุธยา)",
    re.I,
)

FOOD_GROUPS = {"bubble_tea", "coffee", "drink_dessert", "food"}
LANDMARK = re.compile(r"education|school|college|university|place_of_learning|preschool|religious|worship|"
                      r"hospital|government|public_service|shopping_mall|landmark", re.I)


def clean_postcode(raw) -> str | None:
    m = re.search(r"\d{5}", str(raw or ""))
    return m.group(0) if m else None


def norm(s: str | None) -> str:
    s = (s or "").lower()
    s = re.sub(r"^(โรงเรียน|ร\.ร\.?|วัด|โรงพยาบาล?|โรงบาล|รพ\.?|มหาวิทยาลัย|มหาลัย|school|wat|hospital)\s*", "", s)
    return re.sub(r"[\s\-_.,()'\"|/]+", "", s)


def address_reason(postcode: str | None, locality: str | None) -> str | None:
    postcode = postcode if isinstance(postcode, str) else None  # NaN from pandas
    locality = locality if isinstance(locality, str) else None
    if postcode and postcode not in AREA_POSTCODES:
        return f"postcode_outside:{postcode}"
    if locality and not ALLOWED_LOCALITY.match(locality.strip()):
        return f"locality_outside:{locality.strip()}"
    return None


def name_reason(name: str | None, group: str) -> str | None:
    # Food and retail shops are routinely named after a famous origin ("ไส้อั่วเชียงใหม่").
    if group in FOOD_GROUPS or group == "retail" or not name:
        return None
    m = ELSEWHERE_NAME.search(name)
    return f"name_mentions_elsewhere:{m.group(0)}" if m else None


def _places(hits: gpd.GeoDataFrame, cluster_m: float) -> int:
    """Number of distinct places among matching features (greedy clustering by distance)."""
    centres = []
    for g in hits.geometry:
        if not any(g.distance(c) <= cluster_m for c in centres):
            centres.append(g)
    return len(centres)


def osm_elsewhere(cands: gpd.GeoDataFrame, ref: gpd.GeoDataFrame, near_m=1000, far_m=3000, max_places=2,
                  cluster_m=2000) -> pd.Series:
    """For landmark-type records: a distinctive name that greater-Bangkok OSM knows only far away.

    Names match when one normalised name contains the other (e.g. "ปทุมคงคา" vs "วัดปทุมคงคา").
    Common names ("วัดโพธิ์ทอง") match institutions in many separate places and are left alone;
    a big place mapped as several features (Siriraj) counts as one place.
    """
    ref = ref.to_crs(METRIC_CRS)
    keys, geoms = [], []
    for col in ("name", "name:th", "name:en"):
        if col in ref:
            for k, g in zip(ref[col].map(lambda s: norm(s) if isinstance(s, str) else ""), ref.geometry):
                if len(k) >= 6:
                    keys.append(k)
                    geoms.append(g)
    ref_keys = gpd.GeoDataFrame({"key": keys}, geometry=geoms, crs=METRIC_CRS)
    ref_keys = ref_keys[~pd.Series([f"{k}|{g.wkb_hex}" for k, g in zip(ref_keys["key"], ref_keys.geometry)]).duplicated().values]

    out = pd.Series(None, index=cands.index, dtype=object)
    for idx, row in cands.to_crs(METRIC_CRS).iterrows():
        k = norm(row["name"])
        if len(k) < 6:
            continue
        # candidate inside a longer OSM name, or an OSM name covering most of the candidate
        hits = ref_keys[ref_keys["key"].map(lambda r: k in r or (r in k and len(r) >= 0.6 * len(k)))]
        if hits.empty or _places(hits, cluster_m) > max_places:
            continue
        d = hits.distance(row.geometry)
        if d.min() >= far_m and not (d <= near_m).any():
            out[idx] = f"osm_name_elsewhere:{d.min() / 1000:.1f}km"
    return out


def garbled_name(name: str | None) -> bool:
    """Thai names whose vowels/tone marks were stripped in the source ("ราดหน ายอดผ ก")."""
    return sum(1 for t in (name or "").split() if re.fullmatch(r"[ก-ฮ]", t)) >= 2


# Institution-type names, whatever category Overture filed them under ("โรงพยาบา..." as a hotel).
INSTITUTION_NAME = re.compile(r"^(โรงเรียน|ร\.ร\.|วัด|โรงพยาบา|โรงบาล|รพ\.|มหาวิทยาลัย|วิทยาลัย|มัสยิด|โบสถ์)")


def is_landmark(category: str | None, hierarchy: str | None, name: str | None = None) -> bool:
    return bool(LANDMARK.search(f"{category or ''} {hierarchy or ''}")) or bool(INSTITUTION_NAME.match(name or ""))

"""Générateurs de données fictives partagés (CSV de test et données de démo)."""
from __future__ import annotations

import random

import phonenumbers

NAMES = {
    "SN": ["Aïssatou Diop", "Moussa Diallo", "Fatou Ndiaye", "Ibrahima Sarr", "Awa Fall", "Cheikh Ba",
           "Mariama Sow", "Ousmane Faye", "Khady Gueye", "Mamadou Mbaye", "Ndeye Cisse", "Abdoulaye Kane",
           "Coumba Thiam", "Pape Seck", "Astou Diouf", "Babacar Ndour", "Rokhaya Sy"],
    "NG": ["Chinedu Okafor", "Aisha Bello", "Tunde Adeyemi", "Ngozi Eze", "Emeka Nwosu", "Funke Adebayo",
           "Ibrahim Musa", "Yetunde Ogunleye", "Chukwuma Obi", "Halima Yusuf", "Segun Bakare", "Amaka Uche",
           "Kunle Ajayi", "Zainab Abubakar", "Obinna Okeke", "Blessing Etim", "Musa Garba"],
    "GH": ["Kwame Mensah", "Ama Owusu", "Kofi Boateng", "Akosua Asante", "Yaw Darko", "Abena Osei",
           "Kojo Appiah", "Efua Addo", "Kwabena Agyei", "Adwoa Ofori", "Nana Amponsah", "Esi Quaye",
           "Kwesi Antwi", "Afia Bonsu", "Yaa Frimpong", "Fiifi Arthur"],
    "KE": ["Wanjiru Kamau", "Otieno Ochieng", "Achieng Odhiambo", "Kipchoge Rotich"],
}
PREFIXES = {"SN": ["77", "78", "76", "70"], "NG": ["803", "806", "813", "703", "802", "905"],
            "GH": ["24", "54", "55", "20", "50"], "KE": ["712", "722", "733", "701"]}
DIAL = {"SN": "+221", "NG": "+234", "GH": "+233", "KE": "+254"}
LOCAL_LEN = {"SN": 9, "NG": 10, "GH": 9, "KE": 9}
CCY = {"SN": "XOF", "NG": "NGN", "GH": "GHS", "KE": "KES"}
# Opérateurs documentés par Bitnob (codes internes, cf. config/corridors.json). Nigeria : banques (NIP).
OPERATORS = {"SN": ["WAVE", "ORANGE_MONEY", "FREE_MONEY", "EXPRESSO"], "NG": ["ACCESS_BANK", "GTBANK", "OPAY"],
             "GH": ["MTN"], "KE": ["MPESA"]}
# Part de marché approximative utilisée pour les données de démo (illustratif)
SN_OPERATOR_WEIGHTS = {"WAVE": 0.55, "ORANGE_MONEY": 0.30, "FREE_MONEY": 0.10, "EXPRESSO": 0.05}
SN_PREFIX_BY_OPERATOR = {"ORANGE_MONEY": ["77", "78"], "FREE_MONEY": ["76"], "EXPRESSO": ["70"],
                         "WAVE": ["77", "78", "76", "70"]}
SN_REGIONS = ["Dakar", "Thiès", "Diourbel", "Fatick", "Kaolack", "Kaffrine", "Kolda", "Ziguinchor",
              "Sédhiou", "Tambacounda", "Kédougou", "Matam", "Saint-Louis", "Louga"]
SN_FIRST = ["Aïssatou", "Moussa", "Fatou", "Ibrahima", "Awa", "Cheikh", "Mariama", "Ousmane", "Khady", "Mamadou",
            "Ndeye", "Abdoulaye", "Coumba", "Pape", "Astou", "Babacar", "Rokhaya", "Modou", "Bineta", "Alioune",
            "Seynabou", "Lamine", "Dieynaba", "Souleymane", "Maimouna", "El Hadji", "Adama", "Ramatoulaye",
            "Malick", "Penda", "Saliou", "Yacine", "Boubacar", "Sokhna", "Omar", "Fatoumata"]
SN_LAST = ["Diop", "Diallo", "Ndiaye", "Sarr", "Fall", "Ba", "Sow", "Faye", "Gueye", "Mbaye", "Cisse", "Kane",
           "Thiam", "Seck", "Diouf", "Ndour", "Sy", "Sall", "Diedhiou", "Badji", "Mane", "Coly", "Camara",
           "Dieng", "Niang", "Wade", "Toure", "Sane", "Tall", "Dramé", "Barry", "Sylla", "Mendy", "Gomis"]
# fourchettes de paiement d'un livreur pour une semaine (valeurs illustratives)
RANGES = {"SN": (25_000, 75_000, 500), "NG": (15_000, 45_000, 500), "GH": (300, 900, 10), "KE": (2_000, 6_000, 50)}


def phone(rng: random.Random, country: str, pretty: bool = True) -> str:
    while True:
        prefix = rng.choice(PREFIXES[country])
        rest = "".join(str(rng.randint(0, 9)) for _ in range(LOCAL_LEN[country] - len(prefix)))
        number = DIAL[country] + prefix + rest
        if phonenumbers.is_valid_number(phonenumbers.parse(number)):
            if not pretty:
                return number
            # écritures variées, comme dans un vrai fichier Excel
            style = rng.choice(["e164", "spaced", "local"])
            if style == "e164":
                return number
            if style == "spaced":
                return phonenumbers.format_number(phonenumbers.parse(number), phonenumbers.PhoneNumberFormat.INTERNATIONAL)
            return phonenumbers.format_number(phonenumbers.parse(number), phonenumbers.PhoneNumberFormat.NATIONAL)


def amount(rng: random.Random, country: str) -> int:
    lo, hi, step = RANGES[country]
    return rng.randrange(lo, hi + 1, step)




def sn_names(rng: random.Random, n: int) -> list[str]:
    """n noms sénégalais distincts."""
    out: list[str] = []
    while len(out) < n:
        name = f"{rng.choice(SN_FIRST)} {rng.choice(SN_LAST)}"
        if name not in out:
            out.append(name)
    return out


def sn_phone_for(rng: random.Random, operator: str) -> str:
    """Numéro sénégalais valide (E.164) cohérent avec l'opérateur."""
    while True:
        prefix = rng.choice(SN_PREFIX_BY_OPERATOR[operator])
        number = "+221" + prefix + "".join(str(rng.randint(0, 9)) for _ in range(7))
        if phonenumbers.is_valid_number(phonenumbers.parse(number)):
            return number


def weighted(rng: random.Random, weights: dict[str, float]) -> str:
    return rng.choices(list(weights), weights=list(weights.values()))[0]


# --- Les 50 livreurs du scénario BulkPay ERP (Nigeria, Ghana, Sénégal) -------------
# Liste FIXE : les données de démo (seed.py) et le CSV du scénario (make_test_csvs.py)
# contiennent exactement les mêmes personnes, avec les mêmes numéros.
LIVREUR_CITIES = {"NG": {"Lagos": 0.7, "Abuja": 0.3}, "GH": {"Greater Accra": 0.7, "Ashanti": 0.3},
                  "SN": {"Dakar": 0.6, "Thiès": 0.2, "Saint-Louis": 0.1, "Kaolack": 0.1}}
NG_BANKS = ["ACCESS_BANK", "GTBANK", "OPAY"]


def livreurs() -> list[dict]:
    """50 livreurs : 17 au Nigeria, 16 au Ghana, 17 au Sénégal (toujours les mêmes)."""
    rng = random.Random(2026_10)
    out, seen = [], set()
    for country in ("NG", "GH", "SN"):
        for name in NAMES[country]:
            if country == "SN":
                op = weighted(rng, SN_OPERATOR_WEIGHTS)
                num = sn_phone_for(rng, op)
            else:
                op = rng.choice(NG_BANKS) if country == "NG" else "MTN"
                num = phone(rng, country, pretty=False)
            while num in seen:
                num = phone(rng, country, pretty=False) if country != "SN" else sn_phone_for(rng, op)
            seen.add(num)
            out.append({"name": name, "country": country, "currency": CCY[country], "phone": num,
                        "operator": op, "region": weighted(rng, LIVREUR_CITIES[country])})
    return out

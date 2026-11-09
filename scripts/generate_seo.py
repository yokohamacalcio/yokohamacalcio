#!/usr/bin/env python3
"""
generate_seo.py — contenuti statici per crawler + sitemap + calendario.

Legge i JSON del sito e scrive SOLO tra i marker già presenti nelle pagine
(un marker assente viene semplicemente saltato). Supporta partite singole e triangolari (sub_matches).

Marker supportati:
  index.html    UPCOMING_*, PAST_*, SCHEMA_EVENTS_*, SHOWCASE_*
  matches.html UPCOMING_*, PAST_*, SCHEMA_EVENTS_*
  players.html PLAYERS_*, SCHEMA_PLAYERS_*
  stats.html    RANKING_{GOALS,ASSISTS,APPEARANCES,GK,MVP,YELLOWS,REDS}_*, SCHEMA_STATS_*
Altri file generati: sitemap.xml, calendar.ics
"""
import html
import json
import os
import re
import subprocess
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

# ============================================================
# PERCORSI & COSTANTI
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = BASE_DIR if os.path.exists(os.path.join(BASE_DIR, 'matches.json')) else os.path.dirname(BASE_DIR)

SITE = 'https://yokohamacalcio.com'
LOGO = './immagini/logo.png?v=2'
JST = timezone(timedelta(hours=9))


def today_jst():
    return datetime.now(JST).date()


def esc(s):
    return html.escape('' if s is None else str(s), quote=True)


# ============================================================
# UTILITY
# ============================================================
def load_json(path):
    full = os.path.join(ROOT_DIR, path)
    try:
        if os.path.exists(full):
            with open(full, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f'❌ Errore caricamento {path}: {e}')
    return None


def as_list(data, key):
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get(key), list):
        return data[key]
    return []


def write_if_changed(path, content, newline=None):
    full = os.path.join(ROOT_DIR, path)
    try:
        old = None
        if os.path.exists(full):
            with open(full, 'r', encoding='utf-8', newline='') as f:
                old = f.read()
        if old == content:
            return False
        with open(full, 'w', encoding='utf-8', newline=newline) as f:
            f.write(content)
        return True
    except Exception as e:
        print(f'❌ Errore scrittura {path}: {e}')
        return False


def safe_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def norm(s):
    return re.sub(r'[\s\u3000]+', '', str(s or '')).lower()


def split_names(text):
    if not text or str(text).strip() in ('なし', 'Nessuno', '', 'null'):
        return []
    return [x.strip() for x in re.split(r'[,、]', str(text)) if x.strip()]


def strip_marks(s):
    st = str(s or '').strip()
    st = re.sub(r'\s*[(（][^)）]*[)）]', '', st)
    st = re.sub(r'\s*[xX*]\s*\d+', '', st)
    return st.strip()


def match_start(m):
    d, t = m.get('date') or '', m.get('time') or '10:00'
    try:
        return datetime.strptime(f'{d} {t}', '%Y-%m-%d %H:%M').replace(tzinfo=JST)
    except ValueError:
        return None


# ============================================================
# PARSING EVENTI & PUNTEGGI (INCLUSI TRIANGOLARI)
# ============================================================
def parse_score_parts(m):
    if not m:
        return None, None
    sub_matches = m.get('sub_matches') or m.get('subMatches') or []
    if sub_matches:
        ours, theirs, has_score = 0, 0, False
        for sub in sub_matches:
            sc = str(sub.get('score') or sub.get('result') or '').strip()
            mt = re.match(r'^\s*(\d+)\s*-\s*(\d+)\s*$', sc)
            if mt:
                has_score = True
                s1, s2 = int(mt.group(1)), int(mt.group(2))
                is_home_us = (
                    sub.get('home') == 'us'
                    or sub.get('isHome') is True
                    or sub.get('home_team') == 'us'
                    or (sub.get('home') is None and sub.get('isHome') is None and m.get('isHome', True) is not False)
                )
                if is_home_us:
                    ours += s1
                    theirs += s2
                else:
                    ours += s2
                    theirs += s1
        if has_score:
            return ours, theirs

    sc = str(m.get('score') or '').strip()
    mt = re.match(r'^\s*(\d+)\s*-\s*(\d+)\s*$', sc)
    if mt:
        s1, s2 = int(mt.group(1)), int(mt.group(2))
        is_home_us = m.get('isHome', True)
        if is_home_us:
            return s1, s2
        else:
            return s2, s1
    return None, None


def score_left_right(m):
    ours, theirs = parse_score_parts(m)
    if ours is None:
        return m.get('score') or '-'
    return f'{ours} - {theirs}' if m.get('isHome', True) else f'{theirs} - {ours}'


def get_match_scorers(m):
    scorers = []
    sub_matches = m.get('sub_matches') or m.get('subMatches') or []
    if sub_matches:
        for sub in sub_matches:
            sc = sub.get('scorers') or sub.get('goals')
            if sc:
                scorers.extend(split_names(sc))
    if not scorers and m.get('scorers'):
        scorers.extend(split_names(m.get('scorers')))
    return scorers


def get_match_assists(m):
    assists = []
    sub_matches = m.get('sub_matches') or m.get('subMatches') or []
    if sub_matches:
        for sub in sub_matches:
            ast = sub.get('assists') or sub.get('assist')
            if ast:
                assists.extend(split_names(ast))
    if not assists and (m.get('assists') or m.get('assist')):
        assists.extend(split_names(m.get('assists') or m.get('assist')))
    return assists


def get_match_mvps(m):
    mvps = []
    sub_matches = m.get('sub_matches') or m.get('subMatches') or []
    if sub_matches:
        for sub in sub_matches:
            mvp = sub.get('mvp') or sub.get('MVP')
            if mvp:
                mvps.extend(split_names(mvp))
    if not mvps and (m.get('mvp') or m.get('MVP')):
        mvps.extend(split_names(m.get('mvp') or m.get('MVP')))
    seen = set()
    res = []
    for x in mvps:
        if x not in seen:
            seen.add(x)
            res.append(x)
    return res


# ============================================================
# LOOKUP
# ============================================================
def opp_info(m, opponents):
    oid = m.get('opponent_id')
    opp = opponents.get(oid, {}) if isinstance(opponents, dict) else {}
    names = opp.get('name') if isinstance(opp.get('name'), dict) else {}
    name = names.get('ja') or names.get('it') or names.get('en') or m.get('opponent_name') or m.get('team2Name') or oid or 'Opponent'
    logo = opp.get('logo') or m.get('team2Logo') or LOGO
    return name, logo


def loc_info(loc_id, fallback, locations):
    loc = locations.get(loc_id, {}) if isinstance(locations, dict) else {}
    name = loc.get('ja') or fallback or '-'
    url = loc.get('url') or loc.get('maps') or f'https://www.google.com/maps/search/?api=1&query={quote(name)}'
    surface = loc.get('surface', {}).get('ja', '') if isinstance(loc.get('surface'), dict) else ''
    return name, url, surface


def category_label(cat):
    return {'official': '公式戦', 'league': '公式戦', 'friendly': '練習試合', 'tournament': '大会', 'cup': 'カップ戦', 'triangular': '3角戦'}.get(cat, '試合')


def find_player(name, players):
    t = norm(name)
    if not t:
        return None
    keys = ('id', 'name_kanji', 'name_kana', 'name_romaji')
    for p in players:
        if any(norm(p.get(k)) == t for k in keys):
            return p
    if len(t) < 2:
        return None
    hits = []
    for p in players:
        match_found = False
        for k in keys[1:]:
            v = norm(p.get(k))
            if v and (t in v or v in t):
                match_found = True
                break
        if match_found:
            hits.append(p)
    return hits[0] if len(hits) == 1 else None


def person_ref(name, players):
    p = find_player(name, players)
    if p and p.get('id'):
        return {'@type': 'Person', '@id': f'{SITE}/players.html#{p["id"]}', 'name': p.get('name_kanji') or p.get('name_romaji') or name}
    return {'@type': 'Person', 'name': name}


def display_name(p):
    return (p or {}).get('name_kanji') or (p or {}).get('name_romaji') or (p or {}).get('name_kana') or '-'


# ============================================================
# PARTITE
# ============================================================
def team_sides(m, opp_name, opp_logo):
    home = m.get('isHome', True)
    return (('Yokohama Calcio', LOGO, opp_name, opp_logo) if home else (opp_name, opp_logo, 'Yokohama Calcio', LOGO))


def build_index_cards(matches, locations, opponents):
    now = datetime.now(JST)
    upcoming = sorted(
        [m for m in matches if m.get('status') == 'upcoming' and (match_start(m) or now) > now - timedelta(hours=6)],
        key=lambda x: (x.get('date', ''), x.get('time') or '')
    )
    past = sorted(
        [m for m in matches if m.get('status') in ('past', 'live')],
        key=lambda x: (x.get('date', ''), x.get('time') or ''),
        reverse=True
    )
    up_html = ''
    past_html = ''

    if upcoming:
        m = upcoming[0]
        on, ol = opp_info(m, opponents)
        ln, lu, ls = loc_info(m.get('location_id'), m.get('venue'), locations)
        t1, l1, t2, l2 = team_sides(m, on, ol)
        time_html = f'<div class="match-info-item"><i class="fas fa-clock"></i><span>{esc(m["time"])} K.O.</span></div>' if m.get('time') else ''
        surf_html = f'<div class="match-info-item"><i class="fas fa-layer-group"></i><span>{esc(ls)}</span></div>' if ls else ''
        is_triangular = m.get('type') == 'triangular' or m.get('category') == 'triangular' or m.get('isTriangular') or bool(m.get('sub_matches') or m.get('subMatches'))
        badge_tri = '<span class="match-badge badge-tournament">3角戦</span>' if is_triangular else ''

        up_html = f'''<div class="next-match-hero" id="nextMatchBox">
    <div class="next-match-header"><div class="match-badge-group"><span class="next-match-badge">次戦</span>{badge_tri}<span class="match-badge badge-official">{esc(category_label(m.get('category')))}</span></div><span class="match-box-date">{esc(m.get('date'))}</span></div>
    <div class="match-teams-wrapper">
        <div class="teams-logos-row"><div class="hero-logo-wrap"><img src="{esc(l1)}" alt="{esc(t1)}"></div><div class="match-vs-center">VS</div><div class="hero-logo-wrap"><img src="{esc(l2)}" alt="{esc(t2)}"></div></div>
        <div class="teams-names-row"><div class="team-name-col">{esc(t1)}</div><div></div><div class="team-name-col">{esc(t2)}</div></div>
    </div>
    <div class="match-info-hero-bar">{time_html}{surf_html}<div class="match-info-item"><i class="fas fa-map-marker-alt"></i><a href="{esc(lu)}" target="_blank" rel="noopener noreferrer">{esc(ln)}</a></div></div>
    <div class="match-card-footer-hero"><a href="matches.html#{esc(m.get('id'))}" class="btn-match-detail-hero"><span>詳細</span></a></div>
</div>'''

    if past:
        m = past[0]
        on, ol = opp_info(m, opponents)
        ln, lu, _ = loc_info(m.get('location_id'), m.get('venue'), locations)
        t1, l1, t2, l2 = team_sides(m, on, ol)

        is_triangular = m.get('type') == 'triangular' or m.get('category') == 'triangular' or m.get('isTriangular') or bool(m.get('sub_matches') or m.get('subMatches'))
        sub_matches = m.get('sub_matches') or m.get('subMatches') or []
        badge_tri = '<span class="match-badge badge-tournament">3角戦</span>' if is_triangular else ''

        if is_triangular and sub_matches:
            rows_html = []
            for sub in sub_matches:
                is_home_us = sub.get('home') == 'us' or sub.get('isHome') is True or sub.get('home_team') == 'us'
                opp_id = sub.get('opponent_id') or (sub.get('away') if is_home_us else sub.get('home'))
                s_on, s_ol = opp_info({'opponent_id': opp_id}, opponents)
                h_name = 'Yokohama Calcio' if is_home_us else s_on
                a_name = s_on if is_home_us else 'Yokohama Calcio'
                h_logo = LOGO if is_home_us else s_ol
                a_logo = s_ol if is_home_us else LOGO

                rows_html.append(f'''<div class="triangular-match-row">
  <div class="tri-team tri-home">
    <div class="card-logo-wrap md"><img src="{esc(h_logo)}" alt="{esc(h_name)}"></div>
    <span class="tri-team-name">{esc(h_name)}</span>
  </div>
  <div class="tri-score">{esc(sub.get('score') or sub.get('result') or 'VS')}</div>
  <div class="tri-team tri-away">
    <div class="card-logo-wrap md"><img src="{esc(a_logo)}" alt="{esc(a_name)}"></div>
    <span class="tri-team-name">{esc(a_name)}</span>
  </div>
</div>''')
            teams_body = f'<div class="triangular-teams-wrapper">{"".join(rows_html)}</div>'
        else:
            teams_body = f'''<div class="match-teams-wrapper">
    <div class="teams-logos-row"><div class="card-logo-wrap"><img src="{esc(l1)}" alt="{esc(t1)}"></div><div class="match-vs-center score-past">{esc(score_left_right(m))}</div><div class="card-logo-wrap"><img src="{esc(l2)}" alt="{esc(t2)}"></div></div>
    <div class="teams-names-row"><div class="team-name-col">{esc(t1)}</div><div></div><div class="team-name-col">{esc(t2)}</div></div>
</div>'''

        bar = f'<div class="match-info-item"><i class="fas fa-map-marker-alt"></i><a href="{esc(lu)}" target="_blank" rel="noopener noreferrer">{esc(ln)}</a></div>'
        scorers = get_match_scorers(m)
        if scorers:
            bar += f'<div class="match-info-item"><i class="fas fa-futbol"></i><span>{esc(", ".join(scorers))}</span></div>'
        assists = get_match_assists(m)
        if assists:
            bar += f'<div class="match-info-item"><i class="fas fa-hands-helping"></i><span>{esc(", ".join(assists))}</span></div>'
        mvps = get_match_mvps(m)
        if mvps:
            bar += f'<div class="match-info-item"><i class="fas fa-star" style="color:#f59e0b"></i><strong>{esc(", ".join(mvps))}</strong></div>'

        past_html = f'''<div class="match-past-box" id="{esc(m.get('id'))}">
    <div class="match-past-header"><div class="match-badge-group"><span class="match-badge badge-official">前節結果</span>{badge_tri}<span class="match-badge badge-official">{esc(category_label(m.get('category')))}</span></div><span class="match-box-date">{esc(m.get('date'))}</span></div>
    {teams_body}
    <div class="match-info-hero-bar">{bar}</div>
    <div class="match-card-footer"><a href="matches.html#{esc(m.get('id'))}" class="btn-match-detail"><span>詳細</span></a></div>
</div>'''
    return up_html, past_html


def build_matches_page_lists(matches, locations, opponents):
    def article(m):
        on, _ = opp_info(m, opponents)
        ln, lu, _ = loc_info(m.get('location_id'), m.get('venue'), locations)
        t1, _, t2, _ = team_sides(m, on, '')
        done = m.get('status') in ('past', 'live')
        extra = ''
        scorers = get_match_scorers(m)
        if done and scorers:
            extra += f'<p>得点: {esc(", ".join(scorers))}</p>'
        assists = get_match_assists(m)
        if done and assists:
            extra += f'<p>アシスト: {esc(", ".join(assists))}</p>'
        mvps = get_match_mvps(m)
        if done and mvps:
            extra += f'<p>MVP: {esc(", ".join(mvps))}</p>'
        return (f'<article class="mc" id="{esc(m.get("id"))}"><h3>{esc(t1)} {esc(score_left_right(m)) if done else "vs"} {esc(t2)}</h3>'
                f'<p><time datetime="{esc(m.get("date"))}">{esc(m.get("date"))}</time> {esc(m.get("time") or "")} · {esc(category_label(m.get("category")))}</p>'
                f'<p><a href="{esc(lu)}" target="_blank" rel="noopener noreferrer">{esc(ln)}</a></p>{extra}</article>')
    up = sorted([m for m in matches if m.get('status') == 'upcoming'], key=lambda x: (x.get('date', ''), x.get('time') or ''))
    past = sorted([m for m in matches if m.get('status') in ('past', 'live')], key=lambda x: (x.get('date', ''), x.get('time') or ''), reverse=True)
    return '\n'.join(article(m) for m in up), '\n'.join(article(m) for m in past)


def build_event_schemas(matches, locations, opponents, players):
    out = []
    for m in matches:
        on, _ = opp_info(m, opponents)
        ln, _, _ = loc_info(m.get('location_id'), m.get('venue'), locations)
        home = m.get('isHome', True)
        home_team, away_team = ('Yokohama Calcio', on) if home else (on, 'Yokohama Calcio')
        ours, theirs = parse_score_parts(m)
        has_score = ours is not None
        score_str = score_left_right(m)
        name = f'{home_team} vs {away_team}' + (f' ({score_str})' if has_score else '')
        desc = [f'Match {name}.']
        if has_score:
            desc.append(f'Score: {score_str}.')
        scorers = get_match_scorers(m)
        if scorers:
            desc.append(f'Scorers: {", ".join(scorers)}.')
        mvps = get_match_mvps(m)
        if mvps:
            desc.append(f'MVP: {", ".join(mvps)}.')
        desc.append(f'Venue: {ln}.')

        start = match_start(m)
        if not start:
            continue
        end = start + timedelta(hours=2)
        done = m.get('status') in ('past', 'live') or has_score
        ev = {
            '@context': 'https://schema.org', '@type': 'SportsEvent', '@id': f'{SITE}/matches.html#{m.get("id", "")}',
            'name': name, 'description': ' '.join(desc), 'startDate': start.isoformat(), 'endDate': end.isoformat(),
            'eventStatus': 'https://schema.org/EventScheduled', 'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
            'location': {'@type': 'Place', 'name': ln, 'address': {'@type': 'PostalAddress', 'addressLocality': 'Yokohama', 'addressRegion': 'Kanagawa', 'addressCountry': 'JP'}},
            'image': [f'{SITE}/immagini/logo.png?v=2'],
            'organizer': {'@type': 'SportsTeam', 'name': 'Yokohama Calcio', 'url': SITE},
            'homeTeam': {'@type': 'SportsTeam', 'name': home_team}, 'awayTeam': {'@type': 'SportsTeam', 'name': away_team},
            'isAccessibleForFree': True,
        }
        if not done:
            ev['offers'] = {'@type': 'Offer', 'url': f'{SITE}/matches.html#{m.get("id", "")}', 'price': '0', 'priceCurrency': 'JPY', 'availability': 'https://schema.org/InStock', 'validFrom': f'{m.get("date")}T00:00:00+09:00'}
        performers = [person_ref(strip_marks(s), players) for s in scorers]
        if performers:
            ev['performer'] = performers
        out.append(ev)
    return out


# ============================================================
# GIOCATORI & STATISTICHE
# ============================================================
SECTION_ICONS = {'gk': 'fa-hands', 'df': 'fa-shield-alt', 'mf': 'fa-running', 'fw': 'fa-futbol'}
SECTION_LABELS = {'gk': 'GOALKEEPER', 'df': 'DEFENDER', 'mf': 'MIDFIELDER', 'fw': 'FORWARD'}
LEAD_LABEL = {'captain': ('CAPTAIN', ''), 'vice_captain': ('VICE CAPT.', ' vc-fascia')}
LEAD_TITLE = {'captain': 'Captain', 'vice_captain': 'Vice Captain', 'manager': 'Founder & Manager', 'founder': 'Founder & Manager'}


def calculate_age(birth):
    try:
        b = datetime.strptime(birth, '%Y-%m-%d').date()
        t = today_jst()
        return t.year - b.year - ((t.month, t.day) < (b.month, b.day))
    except Exception:
        return '-'


def surname_parts(raw):
    parts = (raw or '').strip().split()
    if not parts:
        return '', []
    if len(parts) >= 2 and parts[0].lower() in ('di', 'de', 'da', 'del', 'della', 'van', 'von', 'san', 'st.'):
        return f'{parts[0]} {parts[1]}'.upper(), parts[2:]
    return parts[0].upper(), parts[1:]


def raw_name(p):
    r = p.get('name_romaji')
    return r if r and r != '-' else (p.get('name_kanji') or '')


def surname_display(p, counts):
    s, rest = surname_parts(raw_name(p))
    if not s:
        return 'YOKOHAMA'
    return f'{s} {rest[-1][0].upper()}.' if counts.get(s, 0) > 1 and rest else s


def player_card(p, counts, st):
    role = p.get('role', 'mf')
    pid = p.get('id') or p.get('number') or p.get('name_kanji')
    kanji = p.get('name_kanji') or '-'
    kana = p.get('name_kana') or kanji
    lead = LEAD_LABEL.get(p.get('leadership_role'))
    fascia = f'<div class="captain-fascia{lead[1]}">{lead[0]}</div>' if lead else ''
    st = st or {}
    detail = [f'役割: {p.get("position", "-")}', f'出身地: {p.get("hometown", "-")}', f'年齢: {calculate_age(p.get("birth_date"))} 歳', f'出場: {safe_int(st.get("caps"))}']
    detail += ([f'失点: {safe_int(st.get("goals_conceded"))}', f'クリーンシート: {safe_int(st.get("clean_sheets"))}'] if role == 'gk' else [f'得点: {safe_int(st.get("goals"))}', f'アシスト: {safe_int(st.get("assists"))}'])
    rows = ''.join(f'<div class="player-detail-row"><span>{esc(d)}</span></div>' for d in detail)
    jersey_gk = 'jersey-gk' if role == 'gk' else ''
    num_str = esc(p.get('number') if p.get('number') is not None else '-')
    return f'''<div class="player-card" id="{esc(pid)}" data-player-id="{esc(pid)}" data-player-role="{esc(role)}">
    <div class="player-card-inner">
        <div class="player-card-front">
            <div class="player-body-jersey {jersey_gk}">{fascia}<div class="jersey-surname-large">{esc(surname_display(p, counts))}</div><div class="jersey-number-large">{num_str}</div></div>
            <div class="player-name-block-front"><div class="player-name-kanji">{esc(kanji)}</div><div class="player-name-romaji">{esc(kana)}</div></div>
        </div>
        <div class="player-card-back"><div class="player-back-name-block"><div class="player-name-kanji">{esc(kanji)}</div></div><div class="player-details-inner">{rows}</div></div>
    </div>
</div>'''


def person_schema(p, st):
    role = (p.get('role') or '').lower()
    st = st or {}
    caps, starters, subs = safe_int(st.get('caps')), safe_int(st.get('starters')), safe_int(st.get('subs'))
    title = f'Soccer Player ({p["position"]})' if p.get('position') else 'Soccer Player'
    if p.get('leadership_role') in LEAD_TITLE:
        title = f'{LEAD_TITLE[p["leadership_role"]]}, {title}'
    person = {'@context': 'https://schema.org', '@type': 'Person', '@id': f'{SITE}/players.html#{p.get("id", "")}',
              'name': display_name(p), 'jobTitle': title, 'memberOf': {'@type': 'SportsTeam', 'name': 'Yokohama Calcio', 'url': SITE}}
    if p.get('name_romaji'):
        person['alternateName'] = p['name_romaji']
    if p.get('number') is not None:
        person['identifier'] = str(p['number'])
    role_label = {'gk': 'Goalkeeper', 'df': 'Defender', 'mf': 'Midfielder', 'fw': 'Forward'}.get(role, 'Player')
    d = [f'{role_label} of Yokohama Calcio.', f'{caps} appearances ({starters} as starter, {subs} as substitute).']
    d.append(f'{safe_int(st.get("goals_conceded"))} goals conceded, {safe_int(st.get("clean_sheets"))} clean sheets.' if role == 'gk' else f'{safe_int(st.get("goals"))} goals, {safe_int(st.get("assists"))} assists.')
    if safe_int(st.get('mvps')):
        d.append(f'{safe_int(st.get("mvps"))} MVP awards.')
    person['description'] = ' '.join(d)
    return person


def build_players(players, stats_map):
    field = [p for p in players if p.get('role') in SECTION_LABELS]
    field.sort(key=lambda p: (p.get('number') is None, p.get('number') if p.get('number') is not None else 9999))
    counts = {}
    for p in field:
        s, _ = surname_parts(raw_name(p))
        if s:
            counts[s] = counts.get(s, 0) + 1
    parts = []
    for role in ('gk', 'df', 'mf', 'fw'):
        cards = '\n'.join(player_card(p, counts, stats_map.get(p.get('id'), {})) for p in field if p.get('role') == role)
        parts.append(f'<section class="role-group"><h2 class="role-title"><i class="fas {SECTION_ICONS[role]}"></i> {SECTION_LABELS[role]}</h2><div class="players-grid">{cards}</div></section>')
    return '\n'.join(parts), [person_schema(p, stats_map.get(p.get('id'), {})) for p in field]


def build_showcase(players, stats_map, n=3):
    rows = [(p, stats_map.get(p.get('id'), {}) or {}) for p in players if p.get('role') != 'staff' and p.get('number') not in (None, '')]
    if not rows:
        return ''
    picks, seen = [], set()
    for key in ('goals', 'assists', 'caps'):
        best = max(rows, key=lambda x: safe_int(x[1].get(key)))
        if best[0].get('id') not in seen:
            picks.append(best)
            seen.add(best[0].get('id'))
    for r in rows:
        if len(picks) >= n:
            break
        if r[0].get('id') not in seen:
            picks.append(r)
            seen.add(r[0].get('id'))
    out = []
    for p, st in picks[:n]:
        role = (p.get('role') or 'mf').lower()
        stats = (f'<span>{safe_int(st.get("caps"))} Pres.</span><span>{safe_int(st.get("goals_conceded"))} Conc.</span>' if role == 'gk'
                 else f'<span>{safe_int(st.get("caps"))} Pres.</span><span>{safe_int(st.get("goals"))} Goals</span><span>{safe_int(st.get("assists"))} Ast</span>')
        out.append(f'<div class="player-preview-card"><div class="player-num-badge">#{esc(p.get("number"))}</div><div class="player-preview-info"><span class="player-pos-badge pos-{esc(role)}">{esc((p.get("position") or role).split("/")[0].upper())}</span><div class="player-preview-name">{esc(display_name(p))}</div><div class="player-preview-sub">{esc(p.get("name_kana"))}</div><div class="player-preview-stats">{stats}</div></div></div>')
    return '\n'.join(out)


# ============================================================
# STATISTICHE RANKING
# ============================================================
def stat_rows(players, stats_map):
    return [(p, stats_map.get(p.get('id'), {}) or {}) for p in players if p.get('role') != 'staff']


def ranking_item(i, name, value_html):
    cls = {1: 'rank-1', 2: 'rank-2', 3: 'rank-3'}.get(i, '')
    return (f'<li class="ranking-item"><div class="rank-left"><span class="rank-number {cls}">{i}</span><span class="rank-name">{esc(name)}</span></div>'
            f'<span class="rank-val">{value_html}</span></li>')


def build_rankings(players, stats_map):
    rows = stat_rows(players, stats_map)
    TOP = 20

    def simple(key, unit):
        sel = sorted([(p, safe_int(st.get(key))) for p, st in rows if safe_int(st.get(key)) > 0], key=lambda x: -x[1])[:TOP]
        return '\n'.join(ranking_item(i, display_name(p), f'{v} {unit}') for i, (p, v) in enumerate(sel, 1))

    apps = sorted([(p, st) for p, st in rows if safe_int(st.get('caps')) > 0], key=lambda x: (-safe_int(x[1].get('caps')), -safe_int(x[1].get('starters')), -safe_int(x[1].get('subs'))))[:TOP]
    gks = sorted([(p, st) for p, st in rows if (p.get('role') or '') == 'gk' and safe_int(st.get('caps')) > 0], key=lambda x: (safe_int(x[1].get('goals_conceded')) / safe_int(x[1].get('caps')), safe_int(x[1].get('goals_conceded'))))[:TOP]
    return {
        'GOALS': simple('goals', '点'), 'ASSISTS': simple('assists', '本'), 'MVP': simple('mvps', '回'),
        'YELLOWS': simple('yellows', '枚'), 'REDS': simple('reds', '枚'),
        'APPEARANCES': '\n'.join(ranking_item(i, display_name(p), f'{safe_int(st.get("caps"))} <small>({safe_int(st.get("subs"))})</small>') for i, (p, st) in enumerate(apps, 1)),
        'GK': '\n'.join(ranking_item(i, display_name(p), f'{safe_int(st.get("goals_conceded"))} 失点 <small>({safe_int(st.get("caps"))}試合 · 平均 {safe_int(st.get("goals_conceded")) / safe_int(st.get("caps")):.2f})</small>') for i, (p, st) in enumerate(gks, 1)),
    }


def build_stats_schemas(players, stats_data):
    stats_map = stats_data.get('players', {}) or {}
    tt = stats_data.get('team_totals', {}) or {}
    if not players or not stats_map:
        return []
    updated = str(stats_data.get('updated_at') or today_jst().isoformat())[:10]
    props = [('appearances', 'Total appearances'), ('starters', 'Appearances as starter'), ('substitute_appearances', 'Appearances from bench'), ('goals', 'Goals scored'), ('assists', 'Assists provided'), ('mvp_awards', 'MVP awards'), ('yellow_cards', 'Yellow cards'), ('red_cards', 'Red cards'), ('goals_conceded', 'Goals conceded (goalkeepers)'), ('clean_sheets', 'Clean sheets (goalkeepers)')]
    schemas = [{
        '@context': 'https://schema.org', '@type': 'Dataset', '@id': f'{SITE}/stats.html#dataset', 'url': f'{SITE}/stats.html',
        'name': 'Yokohama Calcio — Team and Player Statistics',
        'description': (f'Statistics for Yokohama Calcio. Matches: {tt.get("total_matches", 0)}, wins: {tt.get("wins", 0)}, draws: {tt.get("draws", 0)}, losses: {tt.get("losses", 0)}, '
                        f'goals for: {tt.get("goals_for", 0)}, goals against: {tt.get("goals_against", 0)}, clean sheets: {tt.get("clean_sheets", 0)}.'),
        'creator': {'@type': 'SportsTeam', 'name': 'Yokohama Calcio', 'url': SITE}, 'dateModified': updated, 'isAccessibleForFree': True,
        'variableMeasured': [{'@type': 'PropertyValue', 'name': n, 'description': d} for n, d in props]}]
    rows = stat_rows(players, stats_map)

    def itemlist(name, desc, selected, order='https://schema.org/Descending'):
        if not selected:
            return
        schemas.append({'@context': 'https://schema.org', '@type': 'ItemList', '@id': f'{SITE}/stats.html#{name.lower().replace(" ", "-")}', 'name': name, 'description': desc, 'itemListOrder': order, 'numberOfItems': len(selected),
                        'itemListElement': [{'@type': 'ListItem', 'position': i, 'item': {'@type': 'Person', '@id': f'{SITE}/players.html#{p.get("id", "")}', 'name': display_name(p)}} for i, p in enumerate(selected, 1)]})

    def top(key):
        return [p for p, st in sorted([(p, st) for p, st in rows if safe_int(st.get(key)) > 0], key=lambda x: -safe_int(x[1].get(key)))]
    itemlist('Top Scorers', 'Yokohama Calcio top scorers ranked by goals scored.', top('goals'))
    itemlist('Top Assists', 'Yokohama Calcio top assist providers.', top('assists'))
    itemlist('Appearances Ranking', 'Appearances, then starts.', [p for p, st in sorted([(p, st) for p, st in rows if safe_int(st.get('caps')) > 0], key=lambda x: (-safe_int(x[1].get('caps')), -safe_int(x[1].get('starters'))))])
    itemlist('MVP Awards', 'Yokohama Calcio MVP award winners.', top('mvps'))
    itemlist('Goalkeeper Ranking', 'Goalkeepers by average goals conceded per appearance (ascending).', [p for p, st in sorted([(p, st) for p, st in rows if (p.get('role') or '') == 'gk' and safe_int(st.get('caps')) > 0], key=lambda x: safe_int(x[1].get('goals_conceded')) / safe_int(x[1].get('caps')))], 'https://schema.org/Ascending')
    itemlist('Yellow Cards', 'Players ranked by yellow cards.', top('yellows'))
    itemlist('Red Cards', 'Players ranked by red cards.', top('reds'))
    return schemas


# ============================================================
# INIEZIONE NEI MARKER
# ============================================================
def inject_between(filename, start, end, body, label):
    full = os.path.join(ROOT_DIR, filename)
    if body is None or not os.path.exists(full):
        return
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    if start not in content or end not in content:
        return
    new = re.sub(re.escape(start) + r'.*?' + re.escape(end), lambda m: f'{start}\n{body}\n{end}', content, flags=re.DOTALL)
    if write_if_changed(filename, new):
        print(f'✅ {label} → {filename}')


def jsonld_blocks(schemas):
    return '\n'.join('<script type="application/ld+json">\n' + json.dumps(s, ensure_ascii=False, indent=2).replace('</', '<\\/') + '\n</script>' for s in schemas)


def inject_simple(filename, name, body, label):
    inject_between(filename, f'<!-- {name}_START -->', f'<!-- {name}_END -->', body, label)


# ============================================================
# SITEMAP & CALENDARIO
# ============================================================
PAGES = [
    ('index.html', '/', '1.0', 'weekly', ['index.html', 'matches.json', 'news.json']),
    ('matches.html', '/matches.html', '0.9', 'weekly', ['matches.html', 'matches.json']),
    ('players.html', '/players.html', '0.8', 'weekly', ['players.html', 'players.json', 'stats.json']),
    ('stats.html', '/stats.html', '0.8', 'weekly', ['stats.html', 'matches.json', 'stats.json']),
    ('about.html', '/about.html', '0.7', 'monthly', ['about.html', 'players.json']),
    ('contact.html', '/contact.html', '0.7', 'weekly', ['contact.html', 'trainings.json']),
    ('faq.html', '/faq.html', '0.6', 'monthly', ['faq.html']),
    ('privacy.html', '/privacy.html', '0.3', 'yearly', ['privacy.html']),
]


def git_date(path):
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%cI', '--', path], cwd=ROOT_DIR, capture_output=True, text=True, timeout=20).stdout.strip()
        return out[:10] if out else None
    except Exception:
        return None


def build_sitemap():
    today = today_jst().isoformat()
    urls = []
    for fname, loc, prio, freq, deps in PAGES:
        if not os.path.exists(os.path.join(ROOT_DIR, fname)):
            continue
        dates = []
        for x in deps:
            d = git_date(x)
            if d:
                dates.append(d)
        last = max(dates) if dates else today
        u = SITE + loc
        sep = '&' if '?' in u else '?'
        alts = ''.join(
            f'<xhtml:link rel="alternate" hreflang="{l}" href="{xml_escape(u if l == "ja" else u + sep + "lang=" + l)}"/>'
            for l in ('ja', 'it', 'en')
        ) + f'<xhtml:link rel="alternate" hreflang="x-default" href="{xml_escape(u)}"/>'
        urls.append(
            f'  <url><loc>{xml_escape(u)}</loc><lastmod>{last}</lastmod><changefreq>{freq}</changefreq><priority>{prio}</priority>{alts}</url>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + '\n'.join(urls)
        + '\n</urlset>\n'
    )


def ics_text(s):
    return str(s).replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\r', '').replace('\n', '\\n')


def ics_fold(line):
    out, cur = [], ''
    for ch in line:
        if len((cur + ch).encode('utf-8')) > 74:
            out.append(cur)
            cur = ' ' + ch
        else:
            cur += ch
    out.append(cur)

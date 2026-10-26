#!/usr/bin/env python3
"""
generate_seo.py — contenuti statici per crawler + sitemap + calendario.

Legge i JSON del sito e scrive SOLO tra i marker già presenti nelle pagine
(un marker assente viene semplicemente saltato). Non scrive mai i JSON dei dati:
stats.json lo produce il pannello admin nello stesso commit di matches.json.

Marker supportati
  index.html   UPCOMING_*, PAST_*, SCHEMA_EVENTS_*, SHOWCASE_*
  matches.html UPCOMING_*, PAST_*, SCHEMA_EVENTS_*
  players.html PLAYERS_*, SCHEMA_PLAYERS_*
  stats.html   RANKING_{GOALS,ASSISTS,APPEARANCES,GK,MVP,YELLOWS,REDS}_*, SCHEMA_STATS_*
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
# PERCORSI
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
  """Accetta sia [..] sia {"key": [..]} (es. competitions.json)."""
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


def parse_score(score):
  m = re.match(r'^\s*(\d+)\s*-\s*(\d+)\s*$', str(score or ''))
  return (int(m.group(1)), int(m.group(2))) if m else None


def split_names(text):
  if not text or str(text).strip() in ('なし', 'Nessuno', ''):
    return []
  return [x.strip() for x in re.split(r'[,、]', str(text)) if x.strip()]


def strip_marks(s):
  s = re.sub(r'\s*[(（][^)）]*[)）]\s*$', '', s)
  return re.sub(r'\s*[xX*]\s*\d+\s*$', '', s).strip()


def match_start(m):
  d, t = m.get('date') or '', m.get('time') or '10:00'
  try:
    return datetime.strptime(f'{d} {t}', '%Y-%m-%d %H:%M').replace(tzinfo=JST)
  except ValueError:
    return None


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
  return {'official': '公式戦', 'league': '公式戦', 'friendly': '練習試合', 'tournament': '大会', 'cup': 'カップ戦'}.get(cat, '試合')


def find_player(name, players):
  """Esatto su id/kanji/kana/romaji; poi parziale solo se UNICO (evita Fukuda K./D.)."""
  t = norm(name)
  if not t:
    return None
  keys = ('id', 'name_kanji', 'name_kana', 'name_romaji')
  for p in players:
    if any(norm(p.get(k)) == t for k in keys):
      return p
  if len(t) < 2:
    return None
  hits = [p for p in players if any((v := norm(p.get(k))) and (t in v or v in t) for k in keys[1:])]
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


def score_left_right(m):
  """Il punteggio nel JSON è sempre «nostri - loro»; in trasferta si mostra al contrario."""
  s = parse_score(m.get('score'))
  if not s:
    return m.get('score') or '-'
  return f'{s[0]} - {s[1]}' if m.get('isHome', True) else f'{s[1]} - {s[0]}'


def build_index_cards(matches, locations, opponents):
  """Hero «prossima» + card «ultima» per la home (stessa grafica del JS)."""
  now = datetime.now(JST)
  upcoming = sorted([m for m in matches if m.get('status') == 'upcoming' and (match_start(m) or now) > now - timedelta(hours=6)], key=lambda x: (x.get('date', ''), x.get('time') or ''))
  past = sorted([m for m in matches if m.get('status') in ('past', 'live')], key=lambda x: (x.get('date', ''), x.get('time') or ''), reverse=True)
  up_html = past_html = ''

  if upcoming:
    m = upcoming[0]
    on, ol = opp_info(m, opponents)
    ln, lu, ls = loc_info(m.get('location_id'), m.get('venue'), locations)
    t1, l1, t2, l2 = team_sides(m, on, ol)
    time_html = f'<div class="match-info-item"><i class="fas fa-clock"></i><span>{esc(m["time"])} K.O.</span></div>' if m.get('time') else ''
    surf_html = f'<div class="match-info-item"><i class="fas fa-layer-group"></i><span>{esc(ls)}</span></div>' if ls else ''
    up_html = f"""
        <div class="next-match-hero" id="nextMatchBox">
            <div class="next-match-header"><div class="match-badge-group"><span class="next-match-badge">次戦</span><span class="match-badge badge-official">{esc(category_label(m.get('category')))}</span></div><span class="match-box-date">{esc(m.get('date'))}</span></div>
            <div class="match-teams-wrapper">
                <div class="teams-logos-row"><div class="hero-logo-wrap"><img src="{esc(l1)}" alt="{esc(t1)}"></div><div class="match-vs-center">VS</div><div class="hero-logo-wrap"><img src="{esc(l2)}" alt="{esc(t2)}"></div></div>
                <div class="teams-names-row"><div class="team-name-col">{esc(t1)}</div><div></div><div class="team-name-col">{esc(t2)}</div></div>
            </div>
            <div class="match-info-hero-bar">{time_html}{surf_html}<div class="match-info-item"><i class="fas fa-map-marker-alt"></i><a href="{esc(lu)}" target="_blank" rel="noopener noreferrer">{esc(ln)}</a></div></div>
            <div class="match-card-footer-hero"><a href="matches.html#{esc(m.get('id'))}" class="btn-match-detail-hero"><span>詳細</span></a></div>
        </div>"""

  if past:
    m = past[0]
    on, ol = opp_info(m, opponents)
    ln, lu, _ = loc_info(m.get('location_id'), m.get('venue'), locations)
    t1, l1, t2, l2 = team_sides(m, on, ol)
    bar = ''
    names = split_names(m.get('scorers'))
    if names:
      bar += f'<div class="match-info-item"><i class="fas fa-futbol"></i><span>{esc(", ".join(names))}</span></div>'
    if split_names(m.get('mvp')):
      bar += f'<div class="match-info-item"><i class="fas fa-star"></i><strong>{esc(m.get("mvp"))}</strong></div>'
    past_html = f"""
        <div class="match-past-box" id="{esc(m.get('id'))}">
            <div class="match-past-header"><div class="match-badge-group"><span class="match-badge badge-official">前節結果</span><span class="match-badge badge-official">{esc(category_label(m.get('category')))}</span></div><span class="match-box-date">{esc(m.get('date'))}</span></div>
            <div class="match-teams-wrapper">
                <div class="teams-logos-row"><div class="card-logo-wrap"><img src="{esc(l1)}" alt="{esc(t1)}"></div><div class="match-vs-center score-past">{esc(score_left_right(m))}</div><div class="card-logo-wrap"><img src="{esc(l2)}" alt="{esc(t2)}"></div></div>
                <div class="teams-names-row"><div class="team-name-col">{esc(t1)}</div><div></div><div class="team-name-col">{esc(t2)}</div></div>
            </div>
            <div class="match-info-hero-bar"><div class="match-info-item"><i class="fas fa-map-marker-alt"></i><a href="{esc(lu)}" target="_blank" rel="noopener noreferrer">{esc(ln)}</a></div>{bar}</div>
            <div class="match-card-footer"><a href="matches.html#{esc(m.get('id'))}" class="btn-match-detail"><span>詳細</span></a></div>
        </div>"""
  return up_html, past_html


def build_matches_page_lists(matches, locations, opponents):
  """matches.html: TUTTE le partite come HTML semantico (il JS le ridisegna al caricamento)."""
  def article(m):
    on, _ = opp_info(m, opponents)
    ln, lu, _ = loc_info(m.get('location_id'), m.get('venue'), locations)
    t1, _, t2, _ = team_sides(m, on, '')
    done = m.get('status') in ('past', 'live')
    extra = ''
    if done and split_names(m.get('scorers')):
      extra += f'<p>得点: {esc(", ".join(split_names(m.get("scorers"))))}</p>'
    if done and split_names(m.get('mvp')):
      extra += f'<p>MVP: {esc(m.get("mvp"))}</p>'
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
    score = str(m.get('score') or '').strip()
    has_score = parse_score(score) is not None
    name = f'{home_team} vs {away_team}' + (f' ({score_left_right(m)})' if has_score else '')
    desc = [f'Match {name}.']
    if has_score:
      desc.append(f'Score: {score_left_right(m)}.')
    if split_names(m.get('scorers')):
      desc.append(f'Scorers: {m["scorers"]}.')
    if split_names(m.get('mvp')):
      desc.append(f'MVP: {m["mvp"]}.')
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
    if not done:   # offerta gratuita solo per le partite future
      ev['offers'] = {'@type': 'Offer', 'url': f'{SITE}/matches.html#{m.get("id", "")}', 'price': '0', 'priceCurrency': 'JPY', 'availability': 'https://schema.org/InStock', 'validFrom': f'{m.get("date")}T00:00:00+09:00'}
    performers = [person_ref(strip_marks(s), players) for s in split_names(m.get('scorers'))]
    if performers:
      ev['performer'] = performers
    out.append(ev)
  return out


# ============================================================
# GIOCATORI
# ============================================================
SECTION_ICONS = {'gk': 'fa-hands', 'df': 'fa-shield-alt', 'mf': 'fa-running', 'fw': 'fa-futbol'}
BADGE_ICONS = {'gk': 'fa-hands', 'df': 'fa-shield-alt', 'mf': 'fa-running', 'fw': 'fa-bullseye'}
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
  return f"""
            <div class="player-card" id="{esc(pid)}" data-player-id="{esc(pid)}" data-player-role="{esc(role)}">
                <div class="player-card-inner">
                    <div class="player-card-front">
                        <div class="player-body-jersey {'jersey-gk' if role == 'gk' else ''}">{fascia}<div class="jersey-surname-large">{esc(surname_display(p, counts))}</div><div class="jersey-number-large">{esc(p.get('number') if p.get('number') is not None else '-')}</div></div>
                        <div class="player-name-block-front"><div class="player-name-kanji">{esc(kanji)}</div><div class="player-name-romaji">{esc(kana)}</div></div>
                    </div>
                    <div class="player-card-back"><div class="player-back-name-block"><div class="player-name-kanji">{esc(kanji)}</div></div><div class="player-details-inner">{rows}</div></div>
                </div>
            </div>"""


def person_schema(p, st):
  """Niente data di nascita: il sito mostra solo l'età."""
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
      picks.append(best); seen.add(best[0].get('id'))
  for r in rows:
    if len(picks) >= n:
      break
    if r[0].get('id') not in seen:
      picks.append(r); seen.add(r[0].get('id'))
  out = []
  for p, st in picks[:n]:
    role = (p.get('role') or 'mf').lower()
    stats = (f'<span>{safe_int(st.get("caps"))} Pres.</span><span>{safe_int(st.get("goals_conceded"))} Conc.</span>' if role == 'gk'
             else f'<span>{safe_int(st.get("caps"))} Pres.</span><span>{safe_int(st.get("goals"))} Goals</span><span>{safe_int(st.get("assists"))} Ast</span>')
    out.append(f'<div class="player-preview-card"><div class="player-num-badge">#{esc(p.get("number"))}</div><div class="player-preview-info"><span class="player-pos-badge pos-{esc(role)}">{esc((p.get("position") or role).split("/")[0].upper())}</span><div class="player-preview-name">{esc(display_name(p))}</div><div class="player-preview-sub">{esc(p.get("name_kana"))}</div><div class="player-preview-stats">{stats}</div></div></div>')
  return '\n'.join(out)


# ============================================================
# STATISTICHE
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
  """Sostituisce il contenuto tra due marker. Se mancano, non fa nulla."""
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
# SITEMAP
# ============================================================
PAGES = [  # file, url, priorità, frequenza, file che ne cambiano il contenuto
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
    dates = [d for d in (git_date(x) for x in deps) if d]
    last = max(dates) if dates else today
    u = SITE + loc
    sep = '&' if '?' in u else '?'
    alts = ''.join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{xml_escape(u if l == "ja" else u + sep + "lang=" + l)}"/>' for l in ('ja', 'it', 'en')) + f'<xhtml:link rel="alternate" hreflang="x-default" href="{xml_escape(u)}"/>'
    urls.append(f'  <url><loc>{xml_escape(u)}</loc><lastmod>{last}</lastmod><changefreq>{freq}</changefreq><priority>{prio}</priority>{alts}</url>')
  return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + '\n'.join(urls) + '\n</urlset>\n')


# ============================================================
# CALENDARIO .ics (partite + allenamenti)
# ============================================================
def ics_text(s):
  return str(s).replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\r', '').replace('\n', '\\n')


def ics_fold(line):
  out, cur = [], ''
  for ch in line:
    if len((cur + ch).encode('utf-8')) > 74:
      out.append(cur); cur = ' ' + ch
    else:
      cur += ch
  out.append(cur)
  return '\r\n'.join(out)


def build_calendar(matches, trainings, locations, opponents):
  t0 = today_jst()
  stamp = t0.strftime('%Y%m%dT000000Z')
  lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Yokohama Calcio//Site//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Yokohama Calcio', 'X-WR-TIMEZONE:Asia/Tokyo', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H',
           'BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:JST', 'END:STANDARD', 'END:VTIMEZONE']

  def event(uid, start, end, summary, location, desc, url, status='CONFIRMED'):
    lines.extend(['BEGIN:VEVENT', f'UID:{uid}@yokohamacalcio.com', f'DTSTAMP:{stamp}', f'DTSTART;TZID=Asia/Tokyo:{start:%Y%m%dT%H%M%S}', f'DTEND;TZID=Asia/Tokyo:{end:%Y%m%dT%H%M%S}',
                  f'SUMMARY:{ics_text(summary)}', f'LOCATION:{ics_text(location)}', f'DESCRIPTION:{ics_text(desc)}', f'URL:{url}', f'STATUS:{status}', 'END:VEVENT'])

  for m in matches:
    st = match_start(m)
    if not st or (m.get('status') != 'upcoming' and st.date() < t0 - timedelta(days=60)):
      continue
    on, _ = opp_info(m, opponents)
    ln, _, _ = loc_info(m.get('location_id'), m.get('venue'), locations)
    home = m.get('isHome', True)
    name = f'{"Yokohama Calcio" if home else on} vs {on if home else "Yokohama Calcio"}'
    done = parse_score(m.get('score')) is not None and m.get('status') != 'upcoming'
    event(m.get('id', st.strftime('%Y%m%d')), st.replace(tzinfo=None), (st + timedelta(hours=2)).replace(tzinfo=None), name + (f' ({score_left_right(m)})' if done else ''), ln, f'{category_label(m.get("category"))} / {ln}', f'{SITE}/matches.html#{m.get("id", "")}')

  for t in trainings:
    try:
      d = datetime.strptime(t.get('date', ''), '%Y-%m-%d')
    except ValueError:
      continue
    if d.date() < t0 or t.get('status') not in (None, 'upcoming', 'cancelled'):
      continue
    rng = re.search(r'(\d{1,2}):(\d{2})\s*[-–~]\s*(\d{1,2}):(\d{2})', str(t.get('time') or ''))
    one = re.search(r'(\d{1,2}):(\d{2})', str(t.get('time') or ''))
    if rng:
      start = d.replace(hour=int(rng.group(1)), minute=int(rng.group(2))); end = d.replace(hour=int(rng.group(3)), minute=int(rng.group(4)))
    elif one:
      start = d.replace(hour=int(one.group(1)), minute=int(one.group(2))); end = start + timedelta(hours=2)
    else:
      start = d.replace(hour=10); end = start + timedelta(hours=2)
    title = ((t.get('title') or {}).get('ja') or 'チームトレーニング') + ('（体験参加OK）' if t.get('trial_open') else '')
    venue = t.get('venue') or loc_info(t.get('location_id'), '', locations)[0]
    desc = '体験参加はこちら: ' + f'{SITE}/contact.html?type=trial' if t.get('trial_open') else 'Yokohama Calcio team training'
    if t.get('meet_time'):
      desc += f' / 集合 {t["meet_time"]}'
    event(t.get('id') or 'tr_' + d.strftime('%Y%m%d'), start, end, title, venue if venue != '-' else '', desc, f'{SITE}/contact.html?type=trial#training', 'CANCELLED' if t.get('status') == 'cancelled' else 'CONFIRMED')
  lines.append('END:VCALENDAR')
  return '\r\n'.join(ics_fold(l) for l in lines) + '\r\n'


# ============================================================
# MAIN
# ============================================================
if __name__ == '__main__':
  print(f'📂 ROOT_DIR: {ROOT_DIR}')
  matches = load_json('matches.json') or []
  locations = load_json('locations.json') or {}
  opponents = load_json('opponents.json') or {}
  players = as_list(load_json('players.json'), 'players')
  trainings = as_list(load_json('trainings.json'), 'trainings')
  stats_data = load_json('stats.json') or {}
  stats_map = stats_data.get('players', {}) or {}

  # 1) PARTITE
  if matches:
    up_card, last_card = build_index_cards(matches, locations, opponents)
    inject_simple('index.html', 'UPCOMING', up_card, 'Prossima partita')
    inject_simple('index.html', 'PAST', last_card, 'Ultima partita')
    up_list, past_list = build_matches_page_lists(matches, locations, opponents)
    inject_simple('matches.html', 'UPCOMING', up_list, 'Partite future')
    inject_simple('matches.html', 'PAST', past_list, 'Risultati')
    events = build_event_schemas(matches, locations, opponents, players)
    for page in ('index.html', 'matches.html'):
      inject_simple(page, 'SCHEMA_EVENTS', jsonld_blocks(events), 'JSON-LD eventi')
  else:
    print('⚠️ matches.json vuoto: salto le partite.')

  # 2) GIOCATORI
  if players:
    cards, person_schemas = build_players(players, stats_map)
    inject_simple('players.html', 'PLAYERS', cards, 'Schede giocatori')
    inject_simple('players.html', 'SCHEMA_PLAYERS', jsonld_blocks(person_schemas), 'JSON-LD giocatori')
    inject_simple('index.html', 'SHOWCASE', build_showcase(players, stats_map), 'Showcase')

  # 3) STATISTICHE
  if players and stats_map:
    for key, body in build_rankings(players, stats_map).items():
      inject_simple('stats.html', f'RANKING_{key}', body, f'Ranking {key}')
    inject_simple('stats.html', 'SCHEMA_STATS', jsonld_blocks(build_stats_schemas(players, stats_data)), 'JSON-LD stats')

  # 4) SITEMAP + CALENDARIO
  if write_if_changed('sitemap.xml', build_sitemap()):
    print('✅ sitemap.xml aggiornata')
  if matches or trainings:
    if write_if_changed('calendar.ics', build_calendar(matches, trainings, locations, opponents), newline=''):
      print('✅ calendar.ics aggiornato')

  print('🎉 generate_seo.py completato.')

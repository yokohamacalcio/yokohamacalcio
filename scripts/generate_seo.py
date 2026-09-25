import json
import os
import re
from datetime import date, datetime, timedelta

# ============================================================
# PERCORSI ROBUSTI
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = (
    BASE_DIR
    if os.path.exists(os.path.join(BASE_DIR, 'matches.json'))
    else os.path.dirname(BASE_DIR)
)

YOKOHAMA_LOGO = './immagini/logo.png?v=2'
YOKOHAMA_FULL_URL = 'https://yokohamacalcio.com'


# ============================================================
# UTILITY
# ============================================================
def load_json(path):
  full_path = os.path.join(ROOT_DIR, path)
  try:
    if os.path.exists(full_path):
      with open(full_path, 'r', encoding='utf-8') as f:
        return json.load(f)
  except Exception as e:
    print(f'❌ Errore caricamento {path}: {e}')
  return None


def safe_int(v):
  try:
    return int(v)
  except (TypeError, ValueError):
    return 0


def get_opp_info(m, opponents):
  opp_id = m.get('opponent_id')
  opp = opponents.get(opp_id, {}) if isinstance(opponents, dict) else {}
  name = (
      opp.get('name', {}).get('ja')
      if isinstance(opp.get('name'), dict)
      else m.get('team2Name', 'Opponent')
  )
  logo = opp.get('logo') or m.get('team2Logo') or YOKOHAMA_LOGO
  return name, logo


def get_loc_info(loc_id, venue_fallback, locations):
  loc = locations.get(loc_id, {}) if isinstance(locations, dict) else {}
  name = loc.get('ja') or venue_fallback or '-'
  url = (
      loc.get('url')
      or loc.get('maps')
      or f'https://www.google.com/maps/search/?api=1&query={name}'
  )
  surface = (
      loc.get('surface', {}).get('ja', '')
      if isinstance(loc.get('surface'), dict)
      else ''
  )
  return name, url, surface


def get_category_label(cat):
  labels = {
      'official': '公式戦', 'league': '公式戦', 'friendly': '練習試合',
      'tournament': '大会', 'cup': 'カップ戦',
  }
  return labels.get(cat, '試合')


# ============================================================
# PLAYER LOOKUP
# ============================================================
def find_player_by_name(name_str, players_data):
  if not name_str or not players_data:
    return None
  target = str(name_str).strip().lower().replace(' ', '').replace('　', '')
  if not target:
    return None
  for pl in players_data:
    for key in ('name_kanji', 'name_kana', 'name_romaji'):
      v = str(pl.get(key, '')).strip().lower().replace(' ', '').replace('　', '')
      if v and v == target:
        return pl
  for pl in players_data:
    for key in ('name_kanji', 'name_kana', 'name_romaji'):
      v = str(pl.get(key, '')).strip().lower().replace(' ', '').replace('　', '')
      if v and (v in target or target in v):
        return pl
  return None


def person_reference_from_name(name_str, players_data):
  pl = find_player_by_name(name_str, players_data)
  if pl and pl.get('id'):
    return {
        '@type': 'Person',
        '@id': f'{YOKOHAMA_FULL_URL}/players.html#{pl["id"]}',
        'name': pl.get('name_kanji') or pl.get('name_romaji') or name_str,
    }
  return {'@type': 'Person', 'name': name_str}


# ============================================================
# MATCHES + EVENT SCHEMA
# ============================================================
def build_static_matches_html():
  matches = load_json('matches.json') or []
  locations = load_json('locations.json') or {}
  opponents = load_json('opponents.json') or {}
  players_data = load_json('players.json') or []

  if not matches:
    print('⚠️ matches.json vuoto, salto generazione HTML.')
    return '', '', []

  upcoming = [m for m in matches if m.get('status') == 'upcoming']
  past = [m for m in matches if m.get('status') in ['past', 'live']]
  upcoming.sort(key=lambda x: x.get('date', ''))
  past.sort(key=lambda x: x.get('date', ''), reverse=True)

  # HERO PROSSIMA PARTITA
  upcoming_html = ''
  if upcoming:
    next_m = upcoming[0]
    opp_name, opp_logo = get_opp_info(next_m, opponents)
    loc_name, loc_url, loc_surface = get_loc_info(
        next_m.get('location_id'), next_m.get('venue'), locations)
    is_home = next_m.get('isHome', True)
    cat_label = get_category_label(next_m.get('category', ''))

    t1_name = 'Yokohama Calcio' if is_home else opp_name
    t1_logo = YOKOHAMA_LOGO if is_home else opp_logo
    t2_name = opp_name if is_home else 'Yokohama Calcio'
    t2_logo = opp_logo if is_home else YOKOHAMA_LOGO

    date_str = next_m.get('date', '')
    time_str = f"{next_m.get('time')} K.O." if next_m.get('time') else ''
    time_html = (f'<div class="match-info-item"><i class="fas fa-clock" style="color: var(--primary-sky);"></i><span>{time_str}</span></div>' if time_str else '')
    surface_html = (f'<div class="match-info-item"><i class="fas fa-layer-group" style="color: var(--primary-sky);"></i><span>{loc_surface}</span></div>' if loc_surface else '')

    upcoming_html = f"""
        <div class="next-match-hero" id="nextMatchBox">
            <div class="next-match-header">
                <div class="match-badge-group">
                    <span class="next-match-badge">次戦</span>
                    <span class="match-badge badge-official">{cat_label}</span>
                </div>
                <span class="match-box-date" style="color: rgba(255,255,255,0.8);">{date_str}</span>
            </div>
            <div class="next-match-hero-inner">
                <div class="match-teams-wrapper">
                    <div class="teams-logos-row">
                        <div class="hero-logo-wrap"><img src="{t1_logo}" alt="{t1_name}"></div>
                        <div class="match-vs-center">VS</div>
                        <div class="hero-logo-wrap"><img src="{t2_logo}" alt="{t2_name}"></div>
                    </div>
                    <div class="teams-names-row">
                        <div class="team-name-col" style="color: #ffffff;">{t1_name}</div>
                        <div></div>
                        <div class="team-name-col" style="color: #ffffff;">{t2_name}</div>
                    </div>
                </div>
                <div class="match-info-hero-bar">{time_html}{surface_html}</div>
            </div>
            <div>
                <div class="match-box-venue">
                    <a href="{loc_url}" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-map-marker-alt"></i> <span>{loc_name}</span> <i class="fas fa-external-link-alt" style="font-size: 0.7rem; opacity: 0.7;"></i>
                    </a>
                </div>
                <div class="match-card-footer-hero">
                    <a href="matches.html#{next_m.get('id', '')}" class="btn-match-detail-hero"><span>詳細</span> <i class="fas fa-chevron-right"></i></a>
                </div>
            </div>
        </div>
        """

  # ULTIMO RISULTATO
  past_html = ''
  if past:
    last_m = past[0]
    opp_name, opp_logo = get_opp_info(last_m, opponents)
    loc_name, loc_url, _ = get_loc_info(last_m.get('location_id'), last_m.get('venue'), locations)
    is_home = last_m.get('isHome', True)
    cat_label = get_category_label(last_m.get('category', ''))

    t1_name = 'Yokohama Calcio' if is_home else opp_name
    t1_logo = YOKOHAMA_LOGO if is_home else opp_logo
    t2_name = opp_name if is_home else 'Yokohama Calcio'
    t2_logo = opp_logo if is_home else YOKOHAMA_LOGO
    score = last_m.get('score', '-')

    scorers = last_m.get('scorers', '')
    mvp = last_m.get('mvp', '')
    scorers_html = (f'<div class="match-info-item"><i class="fas fa-futbol" style="color: var(--dark-navy);"></i> <span>{scorers}</span></div>' if scorers and scorers not in ['なし', 'Nessuno'] else '')
    mvp_html = (f'<div class="match-info-item"><i class="fas fa-star" style="color: #f59e0b;"></i> <strong style="color: var(--dark-navy);">{mvp}</strong></div>' if mvp and mvp not in ['なし', 'Nessuno'] else '')
    info_bar_html = f'<div class="match-info-hero-bar">{scorers_html}{mvp_html}</div>' if (scorers_html or mvp_html) else ''

    past_html = f"""
        <div class="match-box-card match-past-box" id="{last_m.get('id', '')}">
            <div class="match-past-header">
                <div class="match-badge-group">
                    <span class="match-badge badge-official">前節結果</span>
                    <span class="match-badge badge-official">{cat_label}</span>
                </div>
                <span class="match-box-date">{last_m.get('date', '')}</span>
            </div>
            <div class="match-box-card-inner">
                <div class="match-teams-wrapper">
                    <div class="teams-logos-row">
                        <div class="card-logo-wrap"><img src="{t1_logo}" alt="{t1_name}"></div>
                        <div class="match-vs-center score-past">{score}</div>
                        <div class="card-logo-wrap"><img src="{t2_logo}" alt="{t2_name}"></div>
                    </div>
                    <div class="teams-names-row">
                        <div class="team-name-col">{t1_name}</div>
                        <div></div>
                        <div class="team-name-col">{t2_name}</div>
                    </div>
                </div>
                {info_bar_html}
            </div>
            <div>
                <div class="match-box-venue">
                    <a href="{loc_url}" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-map-marker-alt"></i> <span>{loc_name}</span> <i class="fas fa-external-link-alt" style="font-size: 0.7rem; opacity: 0.7;"></i>
                    </a>
                </div>
                <div class="match-card-footer">
                    <a href="matches.html#{last_m.get('id', '')}" class="btn-match-detail"><span>詳細</span> <i class="fas fa-chevron-right"></i></a>
                </div>
            </div>
        </div>
        """

  # SCHEMA EVENTI (COMPLETO DI TUTTI I CAMPI SCHEMA.ORG / GOOGLE)
  schema_events = []
  for m in matches:
    opp_name, _ = get_opp_info(m, opponents)
    loc_name, _, _ = get_loc_info(m.get('location_id'), m.get('venue'), locations)
    is_home = m.get('isHome', True)
    home_team = 'Yokohama Calcio' if is_home else opp_name
    away_team = opp_name if is_home else 'Yokohama Calcio'
    score = m.get('score', '')
    status = m.get('status', 'upcoming')
    title_score = f' ({score})' if score and score != '-' else ''
    event_name = f'{home_team} vs {away_team}{title_score}'

    desc_parts = [f'Match {event_name}.']
    if score: desc_parts.append(f'Score: {score}.')
    if m.get('scorers') and m.get('scorers') not in ['なし', 'Nessuno']:
      desc_parts.append(f"Scorers: {m.get('scorers')}.")
    if m.get('mvp') and m.get('mvp') not in ['なし', 'Nessuno']:
      desc_parts.append(f"MVP: {m.get('mvp')}.")
    desc_parts.append(f'Venue: {loc_name}.')

    date_str = m.get('date', '')
    time_str = m.get('time', '10:00')
    start_iso = f"{date_str}T{time_str}:00+09:00"

    try:
      start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
      end_dt = start_dt + timedelta(hours=2)
      end_iso = f"{end_dt.strftime('%Y-%m-%dT%H:%M:%S')}+09:00"
    except Exception:
      end_iso = f"{date_str}T12:00:00+09:00"

    if status == 'past' or (score and score != 'VS'):
      event_status = 'https://schema.org/EventCompleted'
    else:
      event_status = 'https://schema.org/EventScheduled'

    event_schema = {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        '@id': f'{YOKOHAMA_FULL_URL}/matches.html#{m.get("id", "")}',
        'name': event_name,
        'description': ' '.join(desc_parts),
        'startDate': start_iso,
        'endDate': end_iso,
        'eventStatus': event_status,
        'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
        'location': {'@type': 'Place', 'name': loc_name},
        'image': [
            f'{YOKOHAMA_FULL_URL}/immagini/logo.png'
        ],
        'organizer': {
            '@type': 'SportsTeam',
            'name': 'Yokohama Calcio',
            'url': YOKOHAMA_FULL_URL
        },
        'offers': {
            '@type': 'Offer',
            'url': f'{YOKOHAMA_FULL_URL}/matches.html',
            'price': '0',
            'priceCurrency': 'JPY',
            'availability': 'https://schema.org/InStock'
        },
        'homeTeam': {'@type': 'SportsTeam', 'name': home_team},
        'awayTeam': {'@type': 'SportsTeam', 'name': away_team},
    }

    performers = []
    scorers_str = str(m.get('scorers', '')).strip()
    if scorers_str and scorers_str not in ['なし', 'Nessuno', '']:
      for s in re.split(r'[,、]', scorers_str):
        name_only = re.sub(r'\s*[xX\*]\s*\d+\s*$', '', s).strip()
        if name_only:
          performers.append(person_reference_from_name(name_only, players_data))
    if performers:
      event_schema['performer'] = performers

    schema_events.append(event_schema)

  return upcoming_html, past_html, schema_events


# ============================================================
# PLAYERS (players.html)
# ============================================================
SECTION_ICONS = {'gk': 'fa-hands', 'df': 'fa-shield-alt', 'mf': 'fa-running', 'fw': 'fa-futbol'}
BADGE_ICONS = {'gk': 'fa-hands', 'df': 'fa-shield-alt', 'mf': 'fa-running', 'fw': 'fa-bullseye'}
SECTION_LABELS = {'gk': 'GOALKEEPER', 'df': 'DEFENDER', 'mf': 'MIDFIELDER', 'fw': 'FORWARD'}
ROLE_BADGE_CLASSES = {'gk': 'role-badge-gk', 'df': 'role-badge-df', 'mf': 'role-badge-mf', 'fw': 'role-badge-fw'}


def calculate_age(birth_date):
  if not birth_date: return '-'
  try:
    birth = datetime.strptime(birth_date, '%Y-%m-%d').date()
    today = date.today()
    age = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day): age -= 1
    return age
  except Exception:
    return '-'


def _extract_surname_parts(raw):
  if not raw: return '', []
  parts = raw.strip().split()
  if not parts: return '', []
  prefixes = ['di', 'de', 'da', 'del', 'della', 'van', 'von', 'san', 'st.']
  if len(parts) >= 2 and parts[0].lower() in prefixes:
    return f'{parts[0]} {parts[1]}'.upper(), parts[2:]
  return parts[0].upper(), parts[1:]


def compute_surname_counts(players):
  counts = {}
  for p in players:
    raw = (p.get('name_romaji') if p.get('name_romaji') and p.get('name_romaji') != '-' else p.get('name_kanji', '')) or ''
    surname, _ = _extract_surname_parts(raw)
    if surname: counts[surname] = counts.get(surname, 0) + 1
  return counts


def get_surname_display(p, surname_counts):
  raw = (p.get('name_romaji') if p.get('name_romaji') and p.get('name_romaji') != '-' else p.get('name_kanji', '')) or 'YOKOHAMA'
  surname, remaining = _extract_surname_parts(raw)
  if not surname: return 'YOKOHAMA'
  if surname_counts.get(surname, 0) > 1 and remaining:
    initial = remaining[-1][0].upper()
    return f'{surname} {initial}.'
  return surname


def _build_details_rows(p, player_stats):
  role = p.get('role', 'mf')
  is_gk = role == 'gk'
  position = p.get('position', '-')
  hometown = p.get('hometown', '-')
  age = calculate_age(p.get('birth_date'))
  role_badge_class = ROLE_BADGE_CLASSES.get(role, 'role-badge-mf')
  role_icon = BADGE_ICONS.get(role, 'fa-user')

  st = player_stats or {}
  caps = st.get('caps', 0)
  starters = st.get('starters', 0)
  subs = st.get('subs', 0)
  goals = st.get('goals', 0)
  assists = st.get('assists', 0)
  mvps = st.get('mvps', 0)
  yellows = st.get('yellows', 0)
  reds = st.get('reds', 0)
  goals_conceded = st.get('goals_conceded', 0)
  clean_sheets = st.get('clean_sheets', 0)

  role_row = ('<div class="player-detail-row">'
      '<span data-i18n="label.role_detail">役割:</span> '
      f'<span class="role-badge-back {role_badge_class}"><i class="fas {role_icon}"></i> <strong>{position}</strong></span></div>')
  hometown_row = ('<div class="player-detail-row">'
      '<span data-i18n="label.hometown">出身地:</span> '
      f'<strong data-hometown="{hometown}"></strong></div>')
  age_row = ('<div class="player-detail-row">'
      '<span data-i18n="label.age">年齢:</span> '
      f'<strong data-age="{age}">{age} 歳</strong></div>')

  caps_row = ('<div class="player-detail-row">'
      '<div class="player-detail-row-left">'
      '<i class="fas fa-tshirt" style="color: var(--dark-navy);"></i> '
      '<span data-i18n="label.appearances">出場数 (先発/途中):</span>'
      '</div>'
      '<strong class="stats-highlight">'
      f'<span class="stat-caps">{caps}</span>'
      f'<span class="sub-stat-detail">(<span class="stat-starters">{starters}</span>/<span class="stat-subs">{subs}</span>)</span>'
      '</strong></div>')

  if is_gk:
    stat_rows = (caps_row
        + f'<div class="player-detail-row"><span><i class="fas fa-shield-halved"></i> <span data-i18n="label.goals_conceded">失点:</span></span> <strong class="stats-highlight stat-goals-conceded">{goals_conceded}</strong></div>'
        + f'<div class="player-detail-row"><span><i class="fas fa-lock"></i> <span data-i18n="label.clean_sheets">クリーンシート:</span></span> <strong class="stats-highlight stat-clean-sheets">{clean_sheets}</strong></div>'
        + f'<div class="player-detail-row"><span><i class="fas fa-star" style="color: #f59e0b;"></i> MVP:</span> <strong class="stats-highlight stat-mvps">{mvps}</strong></div>')
  else:
    stat_rows = (caps_row
        + f'<div class="player-detail-row"><span><i class="fas fa-futbol" style="color: var(--dark-navy);"></i> <span data-i18n="label.goals">得点:</span></span> <strong class="stats-highlight stat-goals">{goals}</strong></div>'
        + f'<div class="player-detail-row"><span><i class="fas fa-shoe-prints" style="color: var(--primary-sky);"></i> <span data-i18n="label.assists">アシスト:</span></span> <strong class="stats-highlight stat-assists">{assists}</strong></div>'
        + f'<div class="player-detail-row"><span><i class="fas fa-star" style="color: #f59e0b;"></i> MVP:</span> <strong class="stats-highlight stat-mvps">{mvps}</strong></div>')

  yellow_row = f'<div class="player-detail-row"><span><i class="fas fa-square" style="color: #f59e0b;"></i> <span data-i18n="label.yellows">警告:</span></span> <strong class="stats-highlight stat-yellows">{yellows}</strong></div>'
  red_row = f'<div class="player-detail-row"><span><i class="fas fa-square" style="color: #ef4444;"></i> <span data-i18n="label.reds">退場:</span></span> <strong class="stats-highlight stat-reds">{reds}</strong></div>'

  return role_row + hometown_row + age_row + stat_rows + yellow_row + red_row


def create_player_card_html(p, surname_counts, player_stats):
  role = p.get('role', 'mf')
  is_gk = role == 'gk'
  number = p.get('number')
  number_str = str(number) if number is not None else '-'
  name_kanji = p.get('name_kanji') or '-'
  name_kana = p.get('name_kana') or name_kanji
  name_romaji = p.get('name_romaji') or name_kanji
  position = p.get('position', '-')
  surname = get_surname_display(p, surname_counts)
  jersey_class = 'jersey-gk' if is_gk else ''
  details_rows = _build_details_rows(p, player_stats)
  player_id = p.get('id') or number or name_kanji

  return f"""
            <div class="player-card" id="{player_id}" data-player-id="{player_id}" data-player-name="{name_kanji}" data-player-kana="{name_kana}" data-player-romaji="{name_romaji}" data-player-pos="{position}" data-player-role="{role}">
                <div class="player-card-inner">
                    <div class="player-card-front">
                        <div class="player-body-jersey {jersey_class}">
                            <div class="jersey-surname-large">{surname}</div>
                            <div class="jersey-number-large">{number_str}</div>
                        </div>
                        <div class="player-name-block-front">
                            <div class="player-name-kanji">{name_kanji}</div>
                            <div class="player-name-romaji">{name_kana}</div>
                        </div>
                        <div class="player-flip-indicator">
                            <i class="fas fa-rotate"></i> <span data-i18n="btn.details">詳細・個人成績</span>
                        </div>
                    </div>
                    <div class="player-card-back">
                        <div class="player-back-name-block">
                            <div class="player-name-kanji">{name_kanji}</div>
                            <div class="player-name-romaji">{name_kana}</div>
                        </div>
                        <div class="player-details-inner">{details_rows}</div>
                        <div class="player-flip-indicator">
                            <i class="fas fa-rotate"></i> <span data-i18n="btn.back">戻る</span>
                        </div>
                    </div>
                </div>
            </div>
        """


def _person_schema_with_stats(p, p_stats):
  name_kanji = p.get('name_kanji') or ''
  name_romaji = p.get('name_romaji') or ''
  position = p.get('position') or ''
  role = (p.get('role') or '').lower()
  pid = p.get('id') or ''

  person = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': f'{YOKOHAMA_FULL_URL}/players.html#{pid}',
      'name': name_kanji or name_romaji or 'Player',
      'memberOf': {'@type': 'SportsTeam', 'name': 'Yokohama Calcio', 'url': YOKOHAMA_FULL_URL},
  }
  if name_romaji: person['alternateName'] = name_romaji
  if p.get('name_kana'): person['givenName'] = p['name_kana']
  if position: person['jobTitle'] = f'Soccer Player ({position})'
  if p.get('birth_date'): person['birthDate'] = p['birth_date']
  if p.get('hometown'): person['birthPlace'] = {'@type': 'Place', 'name': p['hometown']}
  if p.get('number') is not None: person['identifier'] = str(p['number'])

  st = p_stats or {}
  caps = safe_int(st.get('caps', 0))
  starters = safe_int(st.get('starters', 0))
  subs = safe_int(st.get('subs', 0))
  goals = safe_int(st.get('goals', 0))
  assists = safe_int(st.get('assists', 0))
  mvps = safe_int(st.get('mvps', 0))
  yellows = safe_int(st.get('yellows', 0))
  reds = safe_int(st.get('reds', 0))
  conceded = safe_int(st.get('goals_conceded', 0))
  clean_sheets = safe_int(st.get('clean_sheets', 0))

  additional = [
      {'@type': 'PropertyValue', 'name': 'appearances', 'value': caps},
      {'@type': 'PropertyValue', 'name': 'starters', 'value': starters},
      {'@type': 'PropertyValue', 'name': 'substitute_appearances', 'value': subs},
      {'@type': 'PropertyValue', 'name': 'goals', 'value': goals},
      {'@type': 'PropertyValue', 'name': 'assists', 'value': assists},
      {'@type': 'PropertyValue', 'name': 'mvp_awards', 'value': mvps},
      {'@type': 'PropertyValue', 'name': 'yellow_cards', 'value': yellows},
      {'@type': 'PropertyValue', 'name': 'red_cards', 'value': reds},
  ]
  if role == 'gk':
    additional.append({'@type': 'PropertyValue', 'name': 'goals_conceded', 'value': conceded})
    additional.append({'@type': 'PropertyValue', 'name': 'clean_sheets', 'value': clean_sheets})
  person['additionalProperty'] = additional

  role_label = {'gk': 'Goalkeeper', 'df': 'Defender', 'mf': 'Midfielder', 'fw': 'Forward'}.get(role, 'Player')
  desc_parts = [f'{role_label} of Yokohama Calcio.']
  desc_parts.append(f'{caps} appearances ({starters} as starter, {subs} as substitute).')
  if role == 'gk':
    desc_parts.append(f'{conceded} goals conceded, {clean_sheets} clean sheets.')
  else:
    desc_parts.append(f'{goals} goals, {assists} assists.')
  if mvps > 0: desc_parts.append(f'{mvps} MVP award{"s" if mvps != 1 else ""}.')
  person['description'] = ' '.join(desc_parts)

  return person


def build_players_html():
  players_data = load_json('players.json') or []
  stats_data = load_json('stats.json') or {}
  player_stats_map = stats_data.get('players', {})

  if not players_data:
    print('⚠️ players.json vuoto, salto generazione giocatori.')
    return '', []

  field_players = [p for p in players_data if p.get('role') != 'staff']

  def sort_key(p):
    n = p.get('number')
    return (n is None, n if n is not None else 9999)

  sorted_players = sorted(field_players, key=sort_key)
  surname_counts = compute_surname_counts(field_players)

  sections = {'gk': [], 'df': [], 'mf': [], 'fw': []}
  for p in sorted_players:
    role = p.get('role')
    if role in sections:
      p_id = p.get('id') or str(p.get('number')) or p.get('name_kanji')
      sections[role].append((p, player_stats_map.get(p_id, {})))

  html_parts = []
  for role in ['gk', 'df', 'mf', 'fw']:
    cards_html = '\n'.join(create_player_card_html(p, surname_counts, s) for (p, s) in sections[role])
    html_parts.append(f"""
        <div class="role-group" data-role-section="{role}">
            <h3 class="role-title"><i class="fas {SECTION_ICONS[role]}"></i> <span data-i18n="section.{role}">{SECTION_LABELS[role]}</span></h3>
            <div class="players-grid" id="players-{role}">{cards_html}</div>
        </div>
        """)

  schemas = []
  for p in field_players:
    p_stats = player_stats_map.get(p.get('id'), {})
    schemas.append(_person_schema_with_stats(p, p_stats))

  return '\n'.join(html_parts), schemas


# ============================================================
# SHOWCASE per index.html
# ============================================================
def build_static_showcase_html(n=3):
  players_data = load_json('players.json') or []
  stats_map = (load_json('stats.json') or {}).get('players', {})

  enriched = []
  for p in players_data:
    if p.get('role') == 'staff': continue
    if p.get('number') is None or p.get('number') == '': continue
    enriched.append((p, stats_map.get(p.get('id'), {}) or {}))

  if not enriched: return ''

  top_scorer = max(enriched, key=lambda x: safe_int(x[1].get('goals', 0)), default=None)
  top_assist = max(enriched, key=lambda x: safe_int(x[1].get('assists', 0)), default=None)
  top_caps = max(enriched, key=lambda x: safe_int(x[1].get('caps', 0)), default=None)

  picks, seen = [], set()
  for entry in [top_scorer, top_assist, top_caps]:
    if entry and entry[0].get('id') not in seen:
      picks.append(entry); seen.add(entry[0].get('id'))
  for entry in enriched:
    if len(picks) >= n: break
    if entry[0].get('id') not in seen:
      picks.append(entry); seen.add(entry[0].get('id'))

  cards = []
  for p, st in picks[:n]:
    name_ja = p.get('name_kanji') or p.get('name_romaji') or '-'
    name_kana = p.get('name_kana') or ''
    number = p.get('number') or '-'
    role = (p.get('role') or 'mf').lower()
    pos_label = (p.get('position') or role.upper()).split('/')[0].upper()

    caps = safe_int(st.get('caps', 0))
    goals = safe_int(st.get('goals', 0))
    assists = safe_int(st.get('assists', 0))
    mvps = safe_int(st.get('mvps', 0))
    conceded = safe_int(st.get('goals_conceded', 0))

    if role == 'gk':
      stats_html = (f'<span><i class="fas fa-running" style="color:#2563eb;"></i> {caps} Pres.</span>'
                    f'<span><i class="fas fa-shield-alt" style="color:#dc2626;"></i> {conceded} Conc.</span>'
                    + (f'<span><i class="fas fa-star" style="color:#f59e0b;"></i> {mvps} MVP</span>' if mvps > 0 else ''))
    else:
      stats_html = (f'<span><i class="fas fa-running" style="color:#2563eb;"></i> {caps} Pres.</span>'
                    f'<span><i class="fas fa-futbol" style="color:#059669;"></i> {goals} Goals</span>'
                    f'<span><i class="fas fa-hands-helping" style="color:#8b5cf6;"></i> {assists} Ast</span>'
                    + (f'<span><i class="fas fa-star" style="color:#f59e0b;"></i> {mvps} MVP</span>' if mvps > 0 else ''))

    cards.append(f"""
                <div class="player-preview-card">
                    <div class="player-num-badge">#{number}</div>
                    <div class="player-preview-info">
                        <span class="player-pos-badge pos-{role}">{pos_label}</span>
                        <div class="player-preview-name">{name_ja}</div>
                        <div class="player-preview-sub">{name_kana}</div>
                        <div class="player-preview-stats">{stats_html}</div>
                    </div>
                </div>
    """)
  return '\n'.join(cards)


# ============================================================
# STATS: HTML STATICO DEI RANKING (per bot AI)
# ============================================================
def _build_ranking_item_html(rank_idx, player_name, value_html):
  rank_class = 'rank-1' if rank_idx == 1 else 'rank-2' if rank_idx == 2 else 'rank-3' if rank_idx == 3 else ''
  return (
      f'<li class="ranking-item">'
      f'<div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">'
      f'<span class="rank-number {rank_class}" style="flex-shrink:0;">{rank_idx}</span>'
      f'<div class="player-info-wrapper"><span class="player-name-text">{player_name}</span></div>'
      f'</div>'
      f'<span class="stats-highlight" style="white-space: nowrap; flex-shrink: 0;">{value_html}</span>'
      f'</li>'
  )


def _player_display_name_ja(p):
  if not p: return '-'
  if p.get('name_kanji'): return p['name_kanji']
  return p.get('name_romaji') or p.get('name_kana') or '-'


def build_static_stats_rankings():
  """Ritorna un dict { marker_key: html_content } con l'HTML statico
  di ogni classifica (top 20). Il JS lo sovrascrive al render."""
  players_data = load_json('players.json') or []
  stats_data = load_json('stats.json') or {}
  stats_map = stats_data.get('players', {})

  # Arricchisci
  enriched = []
  for p in players_data:
    if p.get('role') == 'staff': continue
    st = stats_map.get(p.get('id'), {}) or {}
    enriched.append((p, st))

  TOP_N = 20

  def build_for(key_getter, sort_key, filter_zero=True, value_fmt=None):
    rows = []
    for p, st in enriched:
      val = key_getter(st)
      if filter_zero and val <= 0: continue
      rows.append((p, st, val))
    rows.sort(key=sort_key, reverse=True)
    rows = rows[:TOP_N]

    items = []
    for idx, (p, st, val) in enumerate(rows, 1):
      name = _player_display_name_ja(p)
      value_html = value_fmt(val, st) if value_fmt else f'{val}'
      items.append(_build_ranking_item_html(idx, name, value_html))
    return '\n'.join(items)

  result = {}

  # GOALS
  result['GOALS'] = build_for(
      key_getter=lambda st: safe_int(st.get('goals', 0)),
      sort_key=lambda x: x[2],
      value_fmt=lambda val, st: f'{val} 点',
  )

  # ASSISTS
  result['ASSISTS'] = build_for(
      key_getter=lambda st: safe_int(st.get('assists', 0)),
      sort_key=lambda x: x[2],
      value_fmt=lambda val, st: f'{val} 本',
  )

  # APPEARANCES (nuova): caps DESC, poi starters DESC
  apps_rows = []
  for p, st in enriched:
    caps = safe_int(st.get('caps', 0))
    if caps <= 0: continue
    starters = safe_int(st.get('starters', 0))
    subs = safe_int(st.get('subs', 0))
    apps_rows.append((p, st, caps, starters, subs))
  apps_rows.sort(key=lambda x: (-x[2], -x[3], -x[4]))
  apps_rows = apps_rows[:TOP_N]
  apps_items = []
  for idx, (p, st, caps, starters, subs) in enumerate(apps_rows, 1):
    name = _player_display_name_ja(p)
    value_html = f'{caps} <span style="font-size: 0.78rem; color: #64748b; font-weight: 600;">({subs})</span>'
    apps_items.append(_build_ranking_item_html(idx, name, value_html))
  result['APPEARANCES'] = '\n'.join(apps_items)

  # GK (solo portieri): gol subiti ASC, poi gol subiti tot ASC
  gk_rows = []
  for p, st in enriched:
    if (p.get('role') or '').lower() != 'gk': continue
    conceded = safe_int(st.get('goals_conceded', 0))
    caps = safe_int(st.get('caps', 0))
    if caps <= 0: continue
    avg = conceded / caps if caps > 0 else 0
    gk_rows.append((p, st, conceded, caps, avg))
  gk_rows.sort(key=lambda x: (x[4], x[2]))
  gk_rows = gk_rows[:TOP_N]
  gk_items = []
  for idx, (p, st, conceded, caps, avg) in enumerate(gk_rows, 1):
    name = _player_display_name_ja(p)
    value_html = (f'{conceded} 失点 '
                  f'<span class="gk-apps-text" style="font-size:0.78rem;color:#64748b;font-weight:600;">({caps}試合)</span>'
                  f'<br><span style="font-size:0.72rem;color:#64748b;font-weight:600;">平均: {avg:.2f}/試合</span>')
    gk_items.append(_build_ranking_item_html(idx, name, value_html))
  result['GK'] = '\n'.join(gk_items)

  # MVP
  result['MVP'] = build_for(
      key_getter=lambda st: safe_int(st.get('mvps', 0)),
      sort_key=lambda x: x[2],
      value_fmt=lambda val, st: f'{val} 回',
  )

  # YELLOWS
  result['YELLOWS'] = build_for(
      key_getter=lambda st: safe_int(st.get('yellows', 0)),
      sort_key=lambda x: x[2],
      value_fmt=lambda val, st: f'{val} 枚',
  )

  # REDS
  result['REDS'] = build_for(
      key_getter=lambda st: safe_int(st.get('reds', 0)),
      sort_key=lambda x: x[2],
      value_fmt=lambda val, st: f'{val} 枚',
  )

  return result


def inject_stats_rankings(filename, rankings):
  """Inietta HTML statico dentro i marker RANKING_*_START/END di stats.html."""
  if not rankings: return
  full_path = os.path.join(ROOT_DIR, filename)
  if not os.path.exists(full_path): return

  try:
    with open(full_path, 'r', encoding='utf-8') as f:
      content = f.read()

    updated = False
    for key, html in rankings.items():
      start = f'<!-- RANKING_{key}_START -->'
      end = f'<!-- RANKING_{key}_END -->'
      if start in content and end in content and html:
        content = re.sub(
            re.escape(start) + r'.*?' + re.escape(end),
            f'{start}\n{html}\n{end}',
            content,
            flags=re.DOTALL,
        )
        updated = True

    if updated:
      with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
      print(f'✅ Ranking statici iniettati in {filename}')

  except Exception as e:
    print(f'❌ Errore ranking {filename}: {e}')


# ============================================================
# STATS: JSON-LD COMPLETO (Dataset + ItemList)
# ============================================================
def build_stats_schemas():
  """Ritorna una lista di schemi JSON-LD per stats.html:
  1. Dataset con team_totals
  2. ItemList per ogni classifica (goals, assists, appearances, mvps, gk, yellows, reds)
  """
  players_data = load_json('players.json') or []
  stats_data = load_json('stats.json') or {}
  stats_map = stats_data.get('players', {})
  team_totals = stats_data.get('team_totals', {})

  if not players_data or not stats_map:
    return []

  schemas = []

  # 1) Dataset con team totals
  today_iso = date.today().isoformat()
  dataset = {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      '@id': f'{YOKOHAMA_FULL_URL}/stats.html#dataset',
      'name': 'Yokohama Calcio — Team and Player Statistics',
      'description': (
          f'Statistical dataset for Yokohama Calcio covering season to date. '
          f'Total matches: {team_totals.get("total_matches", 0)}, '
          f'Wins: {team_totals.get("wins", 0)}, '
          f'Draws: {team_totals.get("draws", 0)}, '
          f'Losses: {team_totals.get("losses", 0)}, '
          f'Goals for: {team_totals.get("goals_for", 0)}, '
          f'Goals against: {team_totals.get("goals_against", 0)}, '
          f'Clean sheets: {team_totals.get("clean_sheets", 0)}.'
      ),
      'creator': {'@type': 'SportsTeam', 'name': 'Yokohama Calcio', 'url': YOKOHAMA_FULL_URL},
      'dateModified': today_iso,
      'license': f'{YOKOHAMA_FULL_URL}/terms',
      'variableMeasured': [
          {'@type': 'PropertyValue', 'name': 'appearances', 'description': 'Total appearances'},
          {'@type': 'PropertyValue', 'name': 'starters', 'description': 'Appearances as starter'},
          {'@type': 'PropertyValue', 'name': 'substitute_appearances', 'description': 'Appearances from bench'},
          {'@type': 'PropertyValue', 'name': 'goals', 'description': 'Goals scored'},
          {'@type': 'PropertyValue', 'name': 'assists', 'description': 'Assists provided'},
          {'@type': 'PropertyValue', 'name': 'mvp_awards', 'description': 'MVP awards'},
          {'@type': 'PropertyValue', 'name': 'yellow_cards', 'description': 'Yellow cards'},
          {'@type': 'PropertyValue', 'name': 'red_cards', 'description': 'Red cards'},
          {'@type': 'PropertyValue', 'name': 'goals_conceded', 'description': 'Goals conceded (goalkeepers)'},
          {'@type': 'PropertyValue', 'name': 'clean_sheets', 'description': 'Clean sheets (goalkeepers)'},
      ],
  }
  schemas.append(dataset)

  # 2) ItemList per ogni classifica
  def _make_itemlist(name, description, rows, item_list_order='https://schema.org/Descending'):
    items = []
    for idx, (p, st, extra) in enumerate(rows, 1):
      person_ref = {
          '@type': 'Person',
          '@id': f'{YOKOHAMA_FULL_URL}/players.html#{p.get("id", "")}',
          'name': p.get('name_kanji') or p.get('name_romaji') or '',
      }
      # allega le stat principali come additionalProperty nel ListItem
      props = extra if extra else {}
      additional = []
      for k, v in props.items():
        if v is None: continue
        additional.append({'@type': 'PropertyValue', 'name': k, 'value': v})
      item = {
          '@type': 'ListItem',
          'position': idx,
          'item': person_ref,
      }
      if additional:
        item['item']['additionalProperty'] = additional
      items.append(item)
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': f'{YOKOHAMA_FULL_URL}/stats.html#{name.lower().replace(" ", "-")}',
        'name': name,
        'description': description,
        'itemListOrder': item_list_order,
        'numberOfItems': len(items),
        'itemListElement': items,
    }

  # Top scorers
  scorers = []
  for p in players_data:
    if p.get('role') == 'staff': continue
    st = stats_map.get(p.get('id'), {}) or {}
    g = safe_int(st.get('goals', 0))
    if g > 0:
      scorers.append((p, st, {'goals': g, 'appearances': safe_int(st.get('caps', 0))}))
  scorers.sort(key=lambda x: -x[2]['goals'])
  if scorers:
    schemas.append(_make_itemlist('Top Scorers', 'Yokohama Calcio top scorers ranked by goals scored.', scorers))

  # Top assists
  assists = []
  for p in players_data:
    if p.get('role') == 'staff': continue
    st = stats_map.get(p.get('id'), {}) or {}
    a = safe_int(st.get('assists', 0))
    if a > 0:
      assists.append((p, st, {'assists': a, 'appearances': safe_int(st.get('caps', 0))}))
  assists.sort(key=lambda x: -x[2]['assists'])
  if assists:
    schemas.append(_make_itemlist('Top Assists', 'Yokohama Calcio top assist providers.', assists))

  # Appearances (ordinamento: caps DESC, starters DESC, subs DESC)
  apps = []
  for p in players_data:
    if p.get('role') == 'staff': continue
    st = stats_map.get(p.get('id'), {}) or {}
    caps = safe_int(st.get('caps', 0))
    if caps <= 0: continue
    starters = safe_int(st.get('starters', 0))
    subs = safe_int(st.get('subs', 0))
    apps.append((p, st, {
        'appearances': caps,
        'starters': starters,
        'substitute_appearances': subs,
    }, caps, starters, subs))
  apps.sort(key=lambda x: (-x[3], -x[4], -x[5]))
  if apps:
    apps_for_list = [(a[0], a[1], a[2]) for a in apps]
    schemas.append(_make_itemlist(
        'Appearances Ranking',
        'Yokohama Calcio appearances ranking. Sorted by total appearances descending, '
        'then by starts from the starting lineup descending. '
        'The value in parentheses in the visual ranking represents appearances from the bench.',
        apps_for_list,
    ))

  # MVP
  mvps = []
  for p in players_data:
    if p.get('role') == 'staff': continue
    st = stats_map.get(p.get('id'), {}) or {}
    m = safe_int(st.get('mvps', 0))
    if m > 0:
      mvps.append((p, st, {'mvp_awards': m, 'appearances': safe_int(st.get('caps', 0))}))
  mvps.sort(key=lambda x: -x[2]['mvp_awards'])
  if mvps:
    schemas.append(_make_itemlist('MVP Awards', 'Yokohama Calcio MVP award winners.', mvps))

  # Goalkeepers (ordinamento: avg conceded ASC)
  gks = []
  for p in players_data:
    if (p.get('role') or '').lower() != 'gk': continue
    st = stats_map.get(p.get('id'), {}) or {}
    caps = safe_int(st.get('caps', 0))
    if caps <= 0: continue
    conceded = safe_int(st.get('goals_conceded', 0))
    avg = conceded / caps if caps > 0 else 0
    gks.append((p, st, {
        'appearances': caps,
        'goals_conceded': conceded,
        'clean_sheets': safe_int(st.get('clean_sheets', 0)),
    }, avg))
  gks.sort(key=lambda x: x[3])
  if gks:
    gks_for_list = [(g[0], g[1], g[2]) for g in gks]
    schemas.append(_make_itemlist(
        'Goalkeeper Ranking',
        'Yokohama Calcio goalkeepers ranked by average goals conceded per appearance (ascending).',
        gks_for_list,
        item_list_order='https://schema.org/Ascending',
    ))

  # Yellows
  yellows = []
  for p in players_data:
    if p.get('role') == 'staff': continue
    st = stats_map.get(p.get('id'), {}) or {}
    y = safe_int(st.get('yellows', 0))
    if y > 0:
      yellows.append((p, st, {'yellow_cards': y}))
  yellows.sort(key=lambda x: -x[2]['yellow_cards'])
  if yellows:
    schemas.append(_make_itemlist('Yellow Cards', 'Yokohama Calcio players ranked by yellow cards.', yellows))

  # Reds
  reds = []
  for p in players_data:
    if p.get('role') == 'staff': continue
    st = stats_map.get(p.get('id'), {})
    r = safe_int(st.get('reds', 0))
    if r > 0:
      reds.append((p, st, {'red_cards': r}))
  reds.sort(key=lambda x: -x[2]['red_cards'])
  if reds:
    schemas.append(_make_itemlist('Red Cards', 'Yokohama Calcio players ranked by red cards.', reds))

  return schemas


# ============================================================
# INIEZIONE
# ============================================================
def inject_html_to_file(filename, upcoming_html, past_html):
  full_path = os.path.join(ROOT_DIR, filename)
  if not os.path.exists(full_path): return
  try:
    with open(full_path, 'r', encoding='utf-8') as f:
      content = f.read()
    updated = False
    if upcoming_html and '<!-- UPCOMING_START -->' in content:
      content = re.sub(r'(<!-- UPCOMING_START -->).*?(<!-- UPCOMING_END -->)',
                       lambda m: f'{m.group(1)}\n{upcoming_html}\n{m.group(2)}',
                       content, flags=re.DOTALL)
      updated = True
    if past_html and '<!-- PAST_START -->' in content:
      content = re.sub(r'(<!-- PAST_START -->).*?(<!-- PAST_END -->)',
                       lambda m: f'{m.group(1)}\n{past_html}\n{m.group(2)}',
                       content, flags=re.DOTALL)
      updated = True
    if updated:
      with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
      print(f'✅ HTML statico iniettato in {filename}')
  except Exception as e:
    print(f'❌ Errore aggiornando {filename}: {e}')


def inject_players_html_to_file(filename, players_html):
  if not players_html: return
  full_path = os.path.join(ROOT_DIR, filename)
  if not os.path.exists(full_path): return
  try:
    with open(full_path, 'r', encoding='utf-8') as f:
      content = f.read()
    if '<!-- PLAYERS_START -->' in content and '<!-- PLAYERS_END -->' in content:
      content = re.sub(r'(<!-- PLAYERS_START -->).*?(<!-- PLAYERS_END -->)',
                       lambda m: f'{m.group(1)}\n{players_html}\n{m.group(2)}',
                       content, flags=re.DOTALL)
      with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
      print(f'✅ Card giocatori iniettate in {filename}')
  except Exception as e:
    print(f'❌ Errore players HTML in {filename}: {e}')


def inject_showcase_html_to_file(filename, showcase_html):
  if not showcase_html: return
  full_path = os.path.join(ROOT_DIR, filename)
  if not os.path.exists(full_path): return
  try:
    with open(full_path, 'r', encoding='utf-8') as f:
      content = f.read()
    if '<!-- SHOWCASE_START -->' in content and '<!-- SHOWCASE_END -->' in content:
      content = re.sub(r'(<!-- SHOWCASE_START -->).*?(<!-- SHOWCASE_END -->)',
                       lambda m: f'{m.group(1)}\n{showcase_html}\n{m.group(2)}',
                       content, flags=re.DOTALL)
      with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
      print(f'✅ Showcase statica iniettata in {filename}')
  except Exception as e:
    print(f'❌ Errore showcase in {filename}: {e}')


def _inject_jsonld_blocks(filename, start_marker, end_marker, schemas, label):
  full_path = os.path.join(ROOT_DIR, filename)
  if not os.path.exists(full_path) or not schemas: return
  try:
    with open(full_path, 'r', encoding='utf-8') as f:
      content = f.read()

    blocks = ['<script type="application/ld+json">\n' +
              json.dumps(s, ensure_ascii=False, indent=2) + '\n</script>'
              for s in schemas]
    block_html = f'{start_marker}\n' + '\n'.join(blocks) + f'\n{end_marker}'

    if start_marker in content and end_marker in content:
      content = re.sub(re.escape(start_marker) + r'.*?' + re.escape(end_marker),
                       block_html, content, flags=re.DOTALL)
      with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
      print(f'✅ {label} iniettato in {filename}')
  except Exception as e:
    print(f'❌ Errore {label} in {filename}: {e}')


def inject_schema_events(filename, schema_events):
  _inject_jsonld_blocks(filename,
                        '<!-- SCHEMA_EVENTS_START -->', '<!-- SCHEMA_EVENTS_END -->',
                        schema_events, 'JSON-LD eventi')


def inject_schema_players(filename, schemas):
  _inject_jsonld_blocks(filename,
                        '<!-- SCHEMA_PLAYERS_START -->', '<!-- SCHEMA_PLAYERS_END -->',
                        schemas, 'Player JSON-LD')


def inject_schema_stats(filename, schemas):
  _inject_jsonld_blocks(filename,
                        '<!-- SCHEMA_STATS_START -->', '<!-- SCHEMA_STATS_END -->',
                        schemas, 'Stats JSON-LD')


# ============================================================
# MAIN
# ============================================================
if __name__ == '__main__':
  print(f'📂 ROOT_DIR rilevata: {ROOT_DIR}')

  # 1) MATCHES
  upcoming_h, past_h, schema_events = build_static_matches_html()
  inject_html_to_file('index.html', upcoming_h, past_h)
  inject_html_to_file('matches.html', upcoming_h, past_h)
  inject_schema_events('index.html', schema_events)
  inject_schema_events('matches.html', schema_events)

  # 2) PLAYERS (solo players.html)
  players_h, schema_players = build_players_html()
  inject_players_html_to_file('players.html', players_h)
  inject_schema_players('players.html', schema_players)

  # 3) SHOWCASE (solo index.html)
  showcase_h = build_static_showcase_html(3)
  inject_showcase_html_to_file('index.html', showcase_h)

  # 4) STATS (solo stats.html)
  rankings = build_static_stats_rankings()
  inject_stats_rankings('stats.html', rankings)

  stats_schemas = build_stats_schemas()
  inject_schema_stats('stats.html', stats_schemas)

  print('🎉 Script Python completato con successo!')

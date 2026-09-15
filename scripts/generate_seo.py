import json
import os
import re

# ============================================================
# PERCORSI ROBUSTI
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

YOKOHAMA_LOGO = './immagini/logo.png?v=2'
YOKOHAMA_FULL_URL = 'https://yokohamacalcio.com'


# ============================================================
# UTILITY
# ============================================================
def load_json(path):
  """Carica un file JSON dalla root del progetto."""
  full_path = os.path.join(ROOT_DIR, path)
  try:
    if os.path.exists(full_path):
      with open(full_path, 'r', encoding='utf-8') as f:
        return json.load(f)
    else:
      print(f'⚠️ File non trovato: {full_path}')
  except Exception as e:
    print(f'❌ Errore caricamento {path}: {e}')
  return None


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
      'official': '公式戦',
      'league': '公式戦',
      'friendly': '練習試合',
      'tournament': '大会',
      'cup': 'カップ戦',
  }
  return labels.get(cat, '試合')


# ============================================================
# GENERAZIONE HTML + SCHEMA
# ============================================================
def build_static_matches_html():
  matches = load_json('matches.json') or []
  locations = load_json('locations.json') or {}
  opponents = load_json('opponents.json') or {}

  if not matches:
    print('⚠️ matches.json vuoto o non trovato, salto generazione HTML.')
    return '', '', []

  upcoming = [m for m in matches if m.get('status') == 'upcoming']
  past = [m for m in matches if m.get('status') in ['past', 'live']]

  upcoming.sort(key=lambda x: x.get('date', ''))
  past.sort(key=lambda x: x.get('date', ''), reverse=True)

  # ------------------------------------------------------------
  # 1. HERO PROSSIMA PARTITA
  # ------------------------------------------------------------
  upcoming_html = ''
  if upcoming:
    next_m = upcoming[0]
    opp_name, opp_logo = get_opp_info(next_m, opponents)
    loc_name, loc_url, loc_surface = get_loc_info(
        next_m.get('location_id'), next_m.get('venue'), locations
    )
    is_home = next_m.get('isHome', True)
    cat_label = get_category_label(next_m.get('category', ''))

    t1_name = 'Yokohama Calcio' if is_home else opp_name
    t1_logo = YOKOHAMA_LOGO if is_home else opp_logo
    t2_name = opp_name if is_home else 'Yokohama Calcio'
    t2_logo = opp_logo if is_home else YOKOHAMA_LOGO

    date_str = next_m.get('date', '')
    time_str = f"{next_m.get('time')} K.O." if next_m.get('time') else ''

    time_html = (
        '<div class="match-info-item"><i class="fas fa-clock" style="color:'
        f' var(--primary-sky);"></i><span>{time_str}</span></div>'
        if time_str
        else ''
    )
    surface_html = (
        '<div class="match-info-item"><i class="fas fa-layer-group"'
        ' style="color:'
        f' var(--primary-sky);"></i><span>{loc_surface}</span></div>'
        if loc_surface
        else ''
    )

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
                <div class="match-info-hero-bar">
                    {time_html}
                    {surface_html}
                </div>
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

  # ------------------------------------------------------------
  # 2. ULTIMO RISULTATO
  # ------------------------------------------------------------
  past_html = ''
  if past:
    last_m = past[0]
    opp_name, opp_logo = get_opp_info(last_m, opponents)
    loc_name, loc_url, _ = get_loc_info(
        last_m.get('location_id'), last_m.get('venue'), locations
    )
    is_home = last_m.get('isHome', True)
    cat_label = get_category_label(last_m.get('category', ''))

    t1_name = 'Yokohama Calcio' if is_home else opp_name
    t1_logo = YOKOHAMA_LOGO if is_home else opp_logo
    t2_name = opp_name if is_home else 'Yokohama Calcio'
    t2_logo = opp_logo if is_home else YOKOHAMA_LOGO
    score = last_m.get('score', '-')

    scorers = last_m.get('scorers', '')
    mvp = last_m.get('mvp', '')

    scorers_html = (
        f"""
        <div class="match-info-item">
            <i class="fas fa-futbol" style="color: var(--dark-navy);"></i>
            <span>{scorers}</span>
        </div>
        """
        if scorers and scorers not in ['なし', 'Nessuno']
        else ''
    )

    mvp_html = (
        f"""
        <div class="match-info-item">
            <i class="fas fa-star" style="color: #f59e0b;"></i>
            <strong style="color: var(--dark-navy);">{mvp}</strong>
        </div>
        """
        if mvp and mvp not in ['なし', 'Nessuno']
        else ''
    )

    info_bar_html = (
        f"""
        <div class="match-info-hero-bar">
            {scorers_html}
            {mvp_html}
        </div>
        """
        if (scorers_html or mvp_html)
        else ''
    )

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

  # ------------------------------------------------------------
  # 3. SCHEMA.ORG EVENTI (JSON-LD COMPLETO)
  # ------------------------------------------------------------
  schema_events = []
  for m in matches:
    opp_name, _ = get_opp_info(m, opponents)
    loc_name, _, _ = get_loc_info(
        m.get('location_id'), m.get('venue'), locations
    )
    is_home = m.get('isHome', True)

    home_team = 'Yokohama Calcio' if is_home else opp_name
    away_team = opp_name if is_home else 'Yokohama Calcio'
    score = m.get('score', '')

    status = m.get('status', 'upcoming')
    title_score = f' ({score})' if score and score != '-' else ''
    event_name = f'{home_team} vs {away_team}{title_score}'

    desc_parts = [f'Match {event_name}.']
    if score:
      desc_parts.append(f'Score: {score}.')
    if m.get('scorers') and m.get('scorers') not in ['なし', 'Nessuno']:
      desc_parts.append(f"Scorers: {m.get('scorers')}.")
    if m.get('mvp') and m.get('mvp') not in ['なし', 'Nessuno']:
      desc_parts.append(f"MVP: {m.get('mvp')}.")
    desc_parts.append(f'Venue: {loc_name}.')

    event_schema = {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        'name': event_name,
        'description': ' '.join(desc_parts),
        'startDate': f"{m.get('date', '')}T{m.get('time', '10:00')}:00+09:00",
        'location': {'@type': 'Place', 'name': loc_name},
        'homeTeam': {'@type': 'SportsTeam', 'name': home_team},
        'awayTeam': {'@type': 'SportsTeam', 'name': away_team},
    }

    if status == 'past' and score:
      event_schema['eventStatus'] = 'https://schema.org/EventCompleted'

    schema_events.append(event_schema)

  return upcoming_html, past_html, schema_events


# ============================================================
# INIEZIONE HTML SICURA
# ============================================================
def inject_html_to_file(filename, upcoming_html, past_html):
  full_path = os.path.join(ROOT_DIR, filename)
  if not os.path.exists(full_path):
    print(f'⚠️ {filename} non trovato, salto.')
    return

  try:
    with open(full_path, 'r', encoding='utf-8') as f:
      content = f.read()

    if upcoming_html:
      content = re.sub(
          r'(<div id="upcomingContainer"[^>]*>)(.*?)(</div>)',
          lambda match: f'{match.group(1)}\n{upcoming_html}\n{match.group(3)}',
          content,
          flags=re.DOTALL,
      )
    if past_html:
      content = re.sub(
          r'(<div id="pastContainer"[^>]*>)(.*?)(</div>)',
          lambda match: f'{match.group(1)}\n{past_html}\n{match.group(3)}',
          content,
          flags=re.DOTALL,
      )

    with open(full_path, 'w', encoding='utf-8') as f:
      f.write(content)
    print(f'✅ HTML Statico iniettato con successo in {filename}')

  except Exception as e:
    print(f'❌ Errore aggiornando {filename}: {e}')


# ============================================================
# MAIN
# ============================================================
if __name__ == '__main__':
  print(f'📂 ROOT_DIR rilevata: {ROOT_DIR}')

  upcoming_h, past_h, schema_events = build_static_matches_html()

  # Iniezione HTML nelle pagine del sito
  for page in ['index.html', 'matches.html', 'players.html', 'stats.html']:
    inject_html_to_file(page, upcoming_h, past_h)

  # Salvataggio schema-events.json
  if schema_events:
    out_path = os.path.join(ROOT_DIR, 'schema-events.json')
    with open(out_path, 'w', encoding='utf-8') as f:
      json.dump(schema_events, f, ensure_ascii=False, indent=2)
    print(f'✅ schema-events.json generato in {out_path}')
  else:
    print('⚠️ Nessun evento schema generato.')

"""
Migrate Linear issues to GitHub Issues + GitHub Project.
Reads the cached Linear issues JSON, creates GH issues, adds to project, sets fields.
"""
import json
import subprocess
import sys
import time
import os

REPO = "jgill248/delve"
PROJECT_NUMBER = 5
PROJECT_ID = "PVT_kwHOAIS_5M4BSjn9"
OWNER = "jgill248"

# Field IDs
STATUS_FIELD = "PVTSSF_lAHOAIS_5M4BSjn9zhADjQE"
PHASE_FIELD = "PVTSSF_lAHOAIS_5M4BSjn9zhAEOtw"
PRIORITY_FIELD = "PVTSSF_lAHOAIS_5M4BSjn9zhAEOyY"

# Status option IDs
STATUS_MAP = {
    "Backlog": "a19e294b",
    "Todo": "578c5091",
    "In Progress": "8c42b8d4",
    "Done": "4baabcce",
    "Canceled": "2ece5864",
    "Duplicate": "2ece5864",  # map to Canceled
}

# Phase option IDs (milestone name -> option ID)
PHASE_MAP = {
    "Phase 1: Foundation": "48119607",
    "Phase 2: Expand Ingestion & Polish": "fe4385b7",
    "Phase 3: Intelligence & Refinement": "b49fc58e",
    "Phase 4: Scale & Ecosystem": "1d2d5713",
    "Phase 5: Obsidian Integration": "6d9767e9",
    "Phase 6: Agentic RAG": "e11cb343",
    "Phase 7: Multi-Modal Knowledge": "1f45ad02",
    "Phase 8: Knowledge Graph Intelligence": "bcbeeae9",
    "Phase 9: Desktop App & Plugin SDK": "db5c28c6",
    "Phase 10: Personal Memory & Proactive Intelligence": "8fd1945b",
    "Phase 11: Reasoning & Voice": "7e31adcf",
    "Phase 12: Dev Tools & Cross-Modal Synthesis": "700bfaf4",
    "Phase 13: Federated Knowledge & Personal Fine-Tuning": "f41517d9",
    "Phase 14: Exploratory Horizons": "df4c62ee",
}

# Priority option IDs
PRIORITY_MAP = {
    "Urgent": "4aa38161",
    "High": "ff8403b5",
    "Normal": "86744050",
    "Low": "6af8682d",
    "None": "06e128a5",
    None: "06e128a5",
}

def run(cmd, input_data=None):
    """Run a command via PowerShell and return stdout."""
    # Wrap in powershell
    full_cmd = ["powershell.exe", "-Command", cmd]
    result = subprocess.run(full_cmd, capture_output=True, text=True, input=input_data)
    if result.returncode != 0 and "already exists" not in result.stderr:
        print(f"  WARN: {result.stderr.strip()[:200]}")
    return result.stdout.strip()

def create_issue(title, body, labels):
    """Create a GitHub issue and return the issue URL."""
    # Write body to temp file to avoid escaping issues
    body_file = os.path.join(os.path.dirname(__file__), "_issue_body.md")
    with open(body_file, "w", encoding="utf-8") as f:
        f.write(body or "")

    label_args = ""
    if labels:
        label_args = " ".join(f'--label "{l}"' for l in labels)

    cmd = f'gh issue create --repo {REPO} --title "{title}" --body-file "{body_file}" {label_args}'
    result = run(cmd)
    # gh issue create returns the URL
    url = result.strip().split("\n")[-1]
    return url

def add_to_project(issue_url):
    """Add issue to project and return the item ID."""
    cmd = f'gh project item-add {PROJECT_NUMBER} --owner {OWNER} --url "{issue_url}" --format json'
    result = run(cmd)
    if result:
        try:
            data = json.loads(result)
            return data.get("id")
        except json.JSONDecodeError:
            print(f"  Could not parse item-add result: {result[:100]}")
    return None

def set_field(item_id, field_id, option_id):
    """Set a single-select field on a project item."""
    if not item_id or not option_id:
        return
    cmd = f'gh project item-edit --project-id {PROJECT_ID} --id {item_id} --field-id {field_id} --single-select-option-id {option_id}'
    run(cmd)

def main():
    issues_file = sys.argv[1]
    data = json.loads(open(issues_file, encoding="utf-8").read())
    text = data[0]["text"]
    issues_data = json.loads(text)
    issues = issues_data.get("issues", [])

    # Optional: start from a specific index (for resuming)
    start_from = int(sys.argv[2]) if len(sys.argv) > 2 else 0

    print(f"Total Linear issues: {len(issues)}")
    print(f"Starting from index: {start_from}")
    print()

    # Track Linear ID -> GH issue number for parent/child linking later
    id_map = {}  # linear_id -> gh_issue_url

    # Sort: parents first (no parent), then children
    parents = [i for i in issues if not i.get("parent")]
    children = [i for i in issues if i.get("parent")]
    sorted_issues = parents + children

    for idx, issue in enumerate(sorted_issues):
        if idx < start_from:
            continue

        linear_id = issue["id"]
        title = issue["title"]
        description = issue.get("description") or ""
        status = issue.get("status", "Backlog")
        labels = issue.get("labels", [])
        milestone_name = (issue.get("projectMilestone") or {}).get("name")
        priority_name = (issue.get("priority") or {}).get("name", "None")
        linear_url = issue.get("url", "")

        # Sanitize title for shell (replace double quotes)
        safe_title = title.replace('"', "'").replace('`', "'")

        # Add Linear reference to description
        body = f"_Migrated from Linear: [{linear_id}]({linear_url})_\n\n{description}"

        print(f"[{idx+1}/{len(sorted_issues)}] {linear_id}: {safe_title}")

        # Create the issue
        issue_url = create_issue(safe_title, body, labels)
        if not issue_url or "github.com" not in issue_url:
            print(f"  FAILED to create issue. Got: {issue_url}")
            continue

        id_map[linear_id] = issue_url
        print(f"  Created: {issue_url}")

        # Add to project
        item_id = add_to_project(issue_url)
        if not item_id:
            print(f"  FAILED to add to project")
            continue

        # Set Status
        status_option = STATUS_MAP.get(status)
        if status_option:
            set_field(item_id, STATUS_FIELD, status_option)

        # Set Phase
        if milestone_name:
            phase_option = PHASE_MAP.get(milestone_name)
            if phase_option:
                set_field(item_id, PHASE_FIELD, phase_option)

        # Set Priority
        priority_option = PRIORITY_MAP.get(priority_name)
        if priority_option:
            set_field(item_id, PRIORITY_FIELD, priority_option)

        # Close the issue if Done or Canceled
        if status in ("Done", "Canceled", "Duplicate"):
            issue_number = issue_url.rstrip("/").split("/")[-1]
            reason = "completed" if status == "Done" else "not_planned"
            run(f'gh issue close {issue_number} --repo {REPO} --reason {reason}')
            print(f"  Closed ({reason})")

        # Small delay to avoid rate limiting
        time.sleep(0.5)

    # Save the ID map for parent/child linking
    map_file = os.path.join(os.path.dirname(__file__), "linear_to_github_map.json")
    with open(map_file, "w") as f:
        json.dump(id_map, f, indent=2)
    print(f"\nDone! ID map saved to {map_file}")

if __name__ == "__main__":
    main()

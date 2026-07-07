# X-Ray Labels

X-Ray mode is the visual proof layer of this project.

The goal is to make the screen explain where each UI block came from. This is inspired by the idea that a learning project should not only work, but also show which architecture and skill produced each visible part.

## Visible Label Rule

The visible label should stay short.

Good examples:

```txt
app/home/HomePage
app/incidents/IncidentsPage
widget/IncidentList
feature/incident/FetchIncidentList
feature/incident/ChangeIncidentStatus
entity/incident/IncidentListItem
shared/ui/SeverityBadge
```

Avoid putting long stack descriptions directly into the label. The label is for quick visual scanning.

## Stored Proof Data

Detailed proof data is stored on DOM attributes instead.

```txt
data-xray-layer
data-xray-label
data-xray-package
data-xray-stacks
title
```

This keeps the UI readable while still leaving enough information for inspection or a future X-Ray Inspector panel.

## Layer Meaning

```txt
app
Route-level page or shell.

widget
A visible screen section assembled from smaller parts.

feature
A user action or behavior, such as fetching data or changing incident status.

entity
A domain object presentation, such as an incident row or detail block.

shared
Reusable UI or utility code not owned by one feature.

remote
Future Module Federation remote content.

package
Future package-level proof blocks when needed.
```

## Current Examples

```txt
app/home/HomePage
Home dashboard page.

app/incidents/IncidentsPage
Incident list route.

app/incidents/IncidentDetailPage
Incident detail route.

widget/SafetyOverview
Home dashboard metric section.

widget/IncidentList
Incident list section.

feature/incident/FetchIncidentList
UI block that proves the list is loaded through REST API fetch.

feature/incident/FetchIncidentDetail
UI block that proves detail data is loaded through REST API fetch.

feature/incident/ChangeIncidentStatus
UI block that proves PATCH status update flow.

entity/incident/IncidentListItem
Domain-level incident item.

entity/incident/IncidentDetail
Domain-level incident detail.

shared/ui/SeverityBadge
Reusable shared UI package component.
```

## Why It Exists

Without X-Ray, a viewer only sees a dashboard.

With X-Ray, a viewer can see:

```txt
which part is page-level app code
which part is a widget
which part is a feature action
which part is an entity representation
which part came from shared UI
which parts prove REST API usage
```

This makes the project easier to explain in review or interview situations.
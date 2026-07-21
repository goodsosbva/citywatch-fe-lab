# X-Ray Labels

X-Ray mode is the visual proof layer of this frontend side project. City monitoring is the product theme; the purpose of X-Ray is to expose the architecture and implementation evidence behind the visible UI.

The goal is to make the screen explain where each UI block came from and which learned frontend implementation produced it.

## Visible Label Rule

The visible label should stay short.

Good examples:

```txt
app/home/HomePage
app/incidents/IncidentsPage
widget/IncidentList
feature/incident/FetchIncidentList
feature/incident/ChangeIncidentStatus
entity/incident/IncidentListItems
```

Avoid putting long stack descriptions directly into the label. The label is for quick visual scanning.

## Boundary Density Rule

Use one X-Ray boundary for one meaningful responsibility. Do not add a new boundary around every repeated row, badge, or button inside that responsibility.

For example, an incident list has one `entity/incident/IncidentListItems` boundary around the whole collection. Each `SeverityBadge`, risk badge, selection button, and detail link stays inside that boundary without its own label.

The parent boundary keeps its domain package in `data-xray-package` and records shared UI usage in `data-xray-stacks`. This keeps the architectural proof visible without making repeated UI unreadable.

## Stored Proof Data

Detailed proof data is stored on DOM attributes instead.

```txt
data-xray-layer
data-xray-label
data-xray-package
data-xray-proofs
data-xray-stacks
title
```

This keeps the UI readable while still leaving enough information for inspection or a future X-Ray Inspector panel.

## Inspector Direction

The current selector separates all boundaries, FSD-style boundaries, and the Module Federation remote boundary. More implemented proof perspectives will be added incrementally.

```txt
architecture → app, widget, feature, entity, shared
rendering    → SSR, client boundary, and related rendering evidence
technology   → OpenLayers, React Three Fiber, WebSocket, and other implementations
source       → app, shared package, or remote
delivery     → local bundle or Module Federation
```

Only implemented evidence appears as an available option. A future technology boundary must not be presented as complete before the corresponding code is connected.

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
Code loaded from a Module Federation remote, such as the analytics calculation module.

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

app/map/MapPage
Map monitoring route.

widget/SafetyOverview
Home dashboard metric section.

widget/IncidentList
Incident list section.

widget/IncidentMapBoard
OpenLayers incident map section.

feature/incident/FetchIncidentList
UI block that proves the list is loaded through REST API fetch.

feature/incident/FetchIncidentMapIncidents
UI block that proves map incidents are loaded through REST API fetch and Redux query state.

feature/map/RenderIncidentMarkers
UI block that proves incident coordinates are rendered through OpenLayers and OpenStreetMap tiles.

feature/incident/FetchIncidentDetail
UI block that proves detail data is loaded through REST API fetch.

feature/incident/ChangeIncidentStatus
UI block that proves PATCH status update flow.

feature/incident/ShareIncidentFilters
UI block that proves incident list filters are shared through Redux state and converted into REST query params.

entity/incident/IncidentListItems
Domain-level incident collection rendered by the list widget.

entity/incident/IncidentDetail
Domain-level incident detail.

entity/incident/IncidentMapSelection
Domain-level selected incident summary on the map page.

remote/analytics/CalculateIncidentAnalytics
Analytics function loaded from `apps/analytics-remote` through a runtime manifest.

`SeverityBadge` remains a reusable shared UI package component, but it is not given a separate visual boundary for every rendered instance.
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

This turns the side project into an explorable record of learned frontend implementations instead of leaving the viewer with only a finished dashboard.

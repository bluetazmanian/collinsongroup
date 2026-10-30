# Airport Trip Planner: Overview

## The problem

A traveller has time before a flight and wants somewhere to eat or shop. They may not know the terminal, and a place that suits their tastes may be too far away or take too long to visit.

The planner uses two existing services: one supplies preferences and flight time, and the other lists airport venues with keywords written by the brands. Additional sources are needed for offers, opening hours, gate details and walking times.

## The approach

The catalogue is prepared in the background. A pre-built model maps different words, such as “cheap” and “budget”, to shared categories. The original words are retained, and the application checks the model's output.

A traveller request uses that catalogue rather than calling the model. The planner applies the time and dietary rules, scores the remaining preference matches and explains the results. Current offers can improve a matching venue's score, but cannot override a hard constraint.

For example, someone interested in affordable food with 90 minutes before departure has 45 usable minutes under the default boarding and walking allowances. A quick-food venue may fit; a longer meal may not. Both allowances are labelled as estimates when the actual facts are unavailable.

## Missing or unreliable data

Departure time alone is not a boarding deadline. Keywords do not prove prices or dietary suitability. Opening hours, queues and walking times may be missing.

The design makes those limits visible. It labels timing estimates, checks offer expiry at request time, warns about stale catalogue data and returns no result when the data is too old or no venue meets the requirements. Model output never supplies dietary facts.

## Where to find the detail

The [architecture overview](answer.md) explains the choices and trade-offs. The [AWS design](aws-deployment.md) contains the service settings and failure handling. [Worked examples](worked-examples.md) show six requests through the rules.

All diagrams and their reading copies are listed under [Documents](documents.md). A local application is available in `app/`; the [README](README.md) explains how to start it. AWS deployment, real-service integration and production measurements are still outstanding.

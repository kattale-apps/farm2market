# Performance Test Results

## Date
2026-06-01

## Test Scope
- Target: `http://localhost:3000/`
- Tool: `npx autocannon`
- Duration: 15 seconds
- Concurrency: 20 connections

## Results
- Total requests: 2,000
- Average throughput: ~126 requests/sec
- Median latency (50%): ~143 ms
- Average latency: ~158 ms
- 97.5th percentile latency: ~336 ms
- 99th percentile latency: ~401 ms

## Notes
- This was a simple local dev probe against the app root page.
- It does not measure production backend/API load, Convex-specific endpoints, or authenticated flows.
- Use this as an initial local-performance estimate rather than a production capacity guarantee.

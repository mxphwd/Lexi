# Dictionary Module

The Dictionary Module reads Lexi's complete vendored Wordset archive only when
a definition request needs it. The compressed archive is fetched once, decoded
in the browser with the platform gzip stream, and cached for later lookups.

`request.ts` recognizes reviewed definition forms, `loader.ts` owns archive
decoding and case-insensitive lookup, and `index.ts` exposes the bounded public
contract. Ordinary conversation continues to use the compact Search Module
index and does not pay the full dictionary-loading cost.

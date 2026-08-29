# Public Launch and Custom Domain

## One-service deployment

The root Dockerfile builds the React frontend and serves it from the same Express process as the API and WebSocket endpoint. This avoids cross-origin and WebSocket routing mistakes.

1. Push the repository publicly.
2. Use `render.yaml` or deploy the Dockerfile on another container host.
3. Attach a persistent disk at `/data`.
4. Configure `SPONSIO_TESTNET_ADDRESS` and `OPERATOR_PRIVATE_KEY`.
5. Confirm `/health` returns `{"ok":true}` over HTTPS.
6. Create a room and confirm the browser opens a secure `wss://` connection.
7. Run `npm run set-live-url -- https://your-public-url`.

## Custom domain

1. Buy or select a domain.
2. Add it in the hosting provider.
3. Add the provider's CNAME or A record at the DNS host.
4. Wait for HTTPS certificate issuance.
5. Set `CORS_ORIGIN` to the final `https://` URL.
6. Run `npm run set-live-url -- https://your-domain`.
7. Rebuild/redeploy and test in an incognito browser.
8. Verify both `https://your-domain/health` and the app's WebSocket connection.

## Public validation

- Open the site while logged out of the host.
- Open the repository while logged out of GitHub.
- Verify Open Graph metadata with a social-card debugger.
- Verify the favicon, title, and description.
- Join with two independent MetaMask wallets.
- Open the join and claim transactions on Monadscan.
- Confirm contract source is published.

## Mainnet gate

Do not reuse the testnet deployment configuration for mainnet. Before pursuing mainnet organizer points:

- Complete an independent security review.
- Use a dedicated multisig or managed operator.
- Decide the protocol fee and unclaimed-fund policy.
- Add chain ID `143` only in an explicit mainnet deployment profile.
- Fund the deployer with the minimum required MON.
- Deploy, verify, and perform a low-value end-to-end room before announcing it.

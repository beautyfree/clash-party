# macOS Kill Switch

Clash Party can keep a PF block active after the app or Mihomo exits. Enable TUN first, then use **Kill Switch** on the TUN page from a macOS administrator account. The privileged helper stores the user's enabled state, restores its PF anchor when launchd restarts it, and leaves the block in place when Clash Party quits. Turning the switch off is the explicit way to restore direct access.

The anchor allows loopback, the configured `utun` interface, and root-owned connections to the active profile's proxy server IP addresses and ports. It blocks other outbound traffic, including LAN traffic. The helper refuses to install when `/etc/pf.conf` contains other custom filter rules; it does not remove rules owned by other software.

The current implementation supports inline proxies and inline proxy providers with fixed server ports. It rejects file and remote proxy providers and other profiles whose server endpoints cannot be enumerated. Hostnames are resolved before enabling and refreshed while the tunnel works. If a server changes IP after the tunnel is already down, DNS cannot be used without an outside-tunnel exception: protection stays on and reconnection can require manual intervention. No such DNS exception is installed.

The helper starts at boot, but PF cannot be guaranteed active before launchd starts it. A root process can also connect directly to the allowed proxy server addresses. Do not describe this mode as an absolute guarantee against every boot-time or root-level leak. A system VPN extension with OS-managed on-demand rules would be needed for a stronger boot boundary.

If the app cannot reach its helper, use **Reconnect helper** in the TUN page. If the app itself cannot start, an administrator can release only Clash Party's block from Terminal without flushing other PF anchors:

```sh
sudo rm -f /var/db/party.mihomo/kill-switch.json
sudo pfctl -a party.mihomo.killswitch -F rules
```

After recovery, reinstall or repair the helper before enabling Kill Switch again.

The implementation uses a separate helper source revision pinned in `scripts/prepare.mjs`. Before merging upstream, coordinate the helper change and replace the fork revision with its upstream release. The legacy Catalina package retains the previous helper and does not provide Kill Switch.

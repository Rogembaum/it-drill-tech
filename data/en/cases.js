/* ============================================================================
   ENGLISH TRANSLATIONS — INCIDENT WALKTHROUGHS
   Keyed by the "key" field of each case in data/cases.js.
   A missing key or a missing field simply falls back to the Russian original,
   and the item is marked RU in the interface.
   Command output is reproduced verbatim; only the comments are translated.
   ============================================================================ */
window.CASES_EN = {
  "disk-full-du-mismatch": {
    tag: "Disk",
    q: "The disk is 100% full, but `du` only accounts for half of it",
    sym: "A disk-usage alert fired overnight for / on a web server. `df` says 100%, the application is logging write errors. Walking the directories with `du` finds 45 GB out of 90 at best.",
    out: `$ df -h /
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        90G   90G     0 100% /

$ du -xsh / 2>/dev/null
45G	/

$ df -i /
Filesystem      Inodes  IUsed   IFree IUse% Mounted on
/dev/sda1      5898240 412330 5485910    8% /`,
    hyp: [
      "A file was deleted while a process still holds it open — the name is gone from the directory (so `du` cannot see it) but the blocks are not freed. **Most likely.**",
      "Data sits underneath a mount point and is masked by the mounted filesystem — `du` cannot see that either.",
      "Space taken by the root reserve (5% on ext4) — but that would explain 4–5 GB, not 45.",
      "LVM/ZFS snapshots holding old blocks — you need to know whether this volume has any."
    ],
    diag: `$ lsof +L1 | head
COMMAND  PID  USER  FD  TYPE DEVICE     SIZE/OFF NLINK NODE NAME
nginx   1841 www   17w REG  8,1    46203371520     0  524 /var/log/nginx/access.log (deleted)

# confirm via /proc
$ ls -l /proc/1841/fd | grep deleted`,
    cause: "logrotate ran with `create`, renamed and deleted the old `access.log`, but the config had no `postrotate` section signalling nginx. The descriptor stayed open on the deleted inode: nginx kept writing 46 GB into a file that no longer exists in the directory tree.",
    fix: [
      "Right now: `nginx -s reopen` (or `kill -USR1 $(cat /var/run/nginx.pid)`) — the process reopens its files, the old inode is released and the space comes back instantly. Restarting the service would do the same, but it drops connections.",
      "Permanently: put `postrotate /usr/bin/nginx -s reopen endscript` back into `/etc/logrotate.d/nginx`, or switch to `copytruncate` (simpler, but it loses the lines written between the copy and the truncate).",
      "Check the other hosts — the config is pushed by configuration management, so the problem is almost certainly not on one server.",
      "For monitoring: alert not only on percentage used, but on the projected exhaustion (`predict_linear` over `node_filesystem_avail_bytes` for four hours)."
    ],
    trap: "Running `rm` on the already-deleted file does nothing, and clearing other directories only buys time. Had this been a database temp file rather than a log, restarting the service would have freed the space but cost downtime — which is why you first look for a way to reopen, and only then restart."
  },
  "inode-exhausted": {
    tag: "Disk",
    q: "`No space left on device` with 60% of the disk free",
    sym: "The session service cannot create a file. `df -h` shows 40% used. The error reproduces even on `touch` in the working directory.",
    out: `$ touch /var/lib/app/sessions/test
touch: cannot touch '/var/lib/app/sessions/test': No space left on device

$ df -h /var
Filesystem      Size  Used Avail Use% Mounted on
/dev/sdb1       200G   79G  112G  42% /var

$ df -i /var
Filesystem       Inodes    IUsed   IFree IUse% Mounted on
/dev/sdb1      13107200 13107198       2  100% /var`,
    hyp: [
      "Inodes are exhausted — with a fixed inode count on ext4 this happens at any amount of free space. **Confirmed immediately by `df -i`.**",
      "The filesystem was remounted read-only after errors — that would give a different error (`Read-only file system`) and entries in `dmesg`.",
      "A user or project quota is full — check with `quota -u app`, `repquota`.",
      "The directory hit an ext3-style subdirectory limit — not a thing on ext4 with `dir_index`."
    ],
    diag: `# where the inodes went: count files per directory
$ for d in /var/lib/app/*; do echo "$(find "$d" -xdev | wc -l) $d"; done | sort -rn | head
13048221 /var/lib/app/sessions
     412 /var/lib/app/cache

$ ls /var/lib/app/sessions | head -3
sess_00003a1f9c...
sess_00003a1fa2...`,
    cause: "File-based sessions were written into a single flat directory with no cleanup: the TTL lived in the application, but the session garbage collector was switched off during a migration. Thirteen million files of 200 bytes took less than 3 GB of data and consumed every inode on the volume.",
    fix: [
      "Right now: delete in batches, not with `rm *` (it will not fit in argv and will be painfully slow): `find /var/lib/app/sessions -type f -mmin +120 -delete`, better still under `ionice -c3` so you do not destroy disk latency.",
      "Fastest of all, if the directory is expendable: create a new one, switch the symlink, and delete the old one in the background (`rm -rf` over 13M files runs for hours).",
      "Permanently: move sessions to Redis or a database; if files stay, shard them into subdirectories (`ab/cd/sess_abcd...`) and turn cleanup back on.",
      "Monitoring: `node_filesystem_files_free` — the metric almost everybody forgets to alert on. XFS allocates inodes dynamically, so moving to XFS removes this class of problem."
    ],
    trap: "The instinctive \"let us clear some logs\" achieves nothing: the problem is not bytes. And `rm -rf` of the whole directory on a busy node creates a multi-hour metadata storm — switching the symlink and deleting slowly is far better."
  },
  "la-high-cpu-idle": {
    tag: "I/O",
    q: "Load average 250 with the CPU 92% idle",
    sym: "A load-average alert. The host has 16 cores, load average 1/5/15 is 251/240/180. `top` shows almost complete idle, yet the service does not respond and `ls` hangs forever in some directories.",
    out: `$ uptime
 03:41:22 up 214 days, load average: 251.4, 240.1, 180.7

$ vmstat 1 3
procs -----------memory---------- ---swap-- ---io--- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa
 0 187      0 4127232 118232 9821244  0    0     0     0  412  890  1  2 92  5
 0 189      0 4127100 118232 9821244  0    0     0     0  398  874  1  2 92  5

$ dmesg -T | tail -2
[Tue Sep  8 03:38:02] nfs: server nfs-prod-02 not responding, still trying
[Tue Sep  8 03:39:14] INFO: task php-fpm:22841 blocked for more than 120 seconds.`,
    hyp: [
      "Mass blocking in state D: in Linux load average counts both R and D, so waiting on I/O raises it without touching the CPU. The `b` column in `vmstat` sitting at 187 confirms it.",
      "A local disk degraded — that would show non-zero `bi/bo` and high `await` in `iostat`; here I/O is zero, so the wait is not on disk.",
      "A network filesystem is unreachable — stated outright in `dmesg`.",
      "A fork bomb or thread leak — then the processes would be in R and the CPU would be busy."
    ],
    diag: `$ ps -eo state,pid,wchan:24,comm | awk '$1=="D"' | head
D  22841 rpc_wait_bit_killable   php-fpm
D  22843 rpc_wait_bit_killable   php-fpm

$ cat /proc/22841/stack
[<0>] rpc_wait_bit_killable+0x33/0xa0
[<0>] __rpc_execute+0x1a2/0x3a0

$ mount | grep nfs
nfs-prod-02:/shared on /mnt/shared type nfs4 (rw,hard,proto=tcp,timeo=600)

$ cat /proc/pressure/io
some avg10=94.22 avg60=91.05 avg300=77.31`,
    cause: "The NFS server `nfs-prod-02` stopped responding. The volume is mounted `hard`, so I/O waits indefinitely and cannot be interrupted by a signal — processes are stuck in D. `kill -9` has no effect by design: a signal is only delivered when the process returns to a state where signals are checked.",
    fix: [
      "Right now: fix the NFS server or the network path to it — that is the only way to unfreeze the processes. Until it is back, the node cannot be treated.",
      "If the server is not coming back: `umount -f -l /mnt/shared` (lazy unmount) frees new clients, but it will not save the ones already hanging; some will die, some will need a node reboot.",
      "Permanently: take the NFS dependency out of the hot path — the application should not reach into a network filesystem on every request. If NFS is required, give it a separate worker pool so its failure cannot consume all of them.",
      "Mount options: `soft` is acceptable only for reading non-critical data (otherwise you risk corruption on write); `hard` plus a sane `timeo`/`retrans` plus monitoring of server availability."
    ],
    trap: "The classic mistake is to start \"offloading the CPU\": killing processes, lowering concurrency, adding nodes. Load average here has nothing to do with the processor. The right first move is the `b` column in `vmstat` and `/proc/pressure/io` — in one second they separate \"not enough CPU\" from \"waiting on I/O\"."
  },
  "cfs-throttling": {
    tag: "CPU",
    q: "After moving to Kubernetes p99 grew 8x at the same traffic",
    sym: "The service moved from a VM to Kubernetes. Average latency barely moved (12 ms against 10), but p99 jumped from 40 ms to 320 ms. CPU utilisation of the pod is 25% of its limit. The application profiler shows nothing unusual.",
    out: `$ kubectl get pod api-7d9f -o jsonpath='{.spec.containers[0].resources}'
{"limits":{"cpu":"1","memory":"2Gi"},"requests":{"cpu":"200m","memory":"1Gi"}}

# inside the pod
$ cat /sys/fs/cgroup/cpu.max
100000 100000

$ cat /sys/fs/cgroup/cpu.stat
usage_usec 184203311
nr_periods 296410
nr_throttled 71284
throttled_usec 41209882`,
    hyp: [
      "CFS throttling: the quota is burned in bursts and the thread then waits out the rest of the 100 ms period. `nr_throttled` at 24% of periods proves it. **Primary hypothesis.**",
      "Noisy neighbours on the node stealing CPU — check via `steal`/`runqlat` and how pods are spread across the node.",
      "Garbage collection pauses in the runtime — but those would have shown on the VM too.",
      "The overlay network added a hop — that would raise the average, not only the tail."
    ],
    diag: `# how many threads actually run against the quota
$ nproc                  # sees every core on the node, not the limit
64
$ ps -o nlwp= -p 1
68

# time spent waiting in the run queue
$ runqlat -m 10 1
     msecs      : count    distribution
         0 -> 1 : 148203   |****************************************|
        64 -> 127 : 3120   |*                                       |`,
    cause: "The runtime saw the node's 64 cores (`nproc` and `runtime.NumCPU` know nothing about cgroups) and started 64 worker threads against a quota of 1 CPU. Those threads burn the whole 100 ms budget in 25 ms, and the pod then stands still for 75. Average latency barely suffers; every twentieth request lands in a pause — hence the tail and only the tail.",
    fix: [
      "Right now: match runtime parallelism to the limit — `GOMAXPROCS` from the cgroup (`automaxprocs`), `-XX:ActiveProcessorCount` for the JVM, an explicit worker count for Python and Node.",
      "Revisit the limit itself: either raise `cpu.limit` to cover real bursts, or drop the CPU limit entirely for latency-critical services and keep only the request. Never do this with memory — memory is not compressible.",
      "Enable `cpu.max.burst` if your kernel supports it: it lets unused budget accumulate and be spent during a spike.",
      "Monitoring: `container_cpu_cfs_throttled_seconds_total` and the ratio `nr_throttled / nr_periods`. Non-zero throttling at low utilisation is precisely the signal that ordinary CPU graphs do not carry."
    ],
    trap: "Looking at \"CPU usage 25%\" and concluding there is enough processor. Utilisation is averaged over seconds and completely hides 75 ms pauses. A latency tail is almost always explained by a timer, not by average load."
  },
  "oomkilled-page-cache": {
    tag: "Memory",
    q: "The pod is OOM-killed while the application uses 300 MB of a 1 GB limit",
    sym: "A file-processing pod gets OOMKilled (exit 137) every few hours. JVM metrics show a heap of 280–320 MB. The memory limit is 1 Gi.",
    out: `$ kubectl describe pod worker-5f8c | grep -A3 'Last State'
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137

# inside the pod, one minute before it died
$ cat /sys/fs/cgroup/memory.current
1070399488
$ cat /sys/fs/cgroup/memory.stat | head -6
anon 402653184
file 601882624
kernel_stack 3211264
slab 21495808
sock 1048576
shmem 134217728`,
    hyp: [
      "The cgroup limit counts more than the heap: non-heap anonymous memory (metaspace, thread stacks, native buffers), **page cache produced by the pod itself**, and tmpfs. `file` at 574 MB confirms it.",
      "A leak outside the heap — direct byte buffers, JNI, glibc arenas; check `anon` against heap size.",
      "A genuine heap leak — ruled out by the JVM metrics.",
      "A sidecar in the same pod ate the shared limit — check whether the limit is per-pod or per-container."
    ],
    diag: `# what actually grows before the kill
$ while :; do awk '/^anon |^file |^shmem /{printf "%s=%dM ", $1, $2/1048576}' \\
    /sys/fs/cgroup/memory.stat; echo; sleep 10; done
anon=384M file=210M shmem=128M
anon=386M file=498M shmem=128M
anon=389M file=712M shmem=128M   <-- the file cache is growing

$ dmesg -T | grep -i 'memory cgroup'
memory: usage 1048576kB, limit 1048576kB, failcnt 214
Memory cgroup out of memory: Killed process 1 (java)`,
    cause: "The worker unpacked uploaded archives into a temporary directory mounted as `emptyDir` (on disk by default, but in memory with `medium: Memory`). The written files landed in page cache, which **is counted in the cgroup's `memory.current`**, and tmpfs counts as memory directly. Reclaim could not keep up with the write rate, so the cgroup OOM fired while the application held a third of its limit.",
    fix: [
      "Right now: raise the limit and/or move the temp directory to disk (`emptyDir: {}` instead of `medium: Memory`), or better to a dedicated volume with a `sizeLimit`.",
      "Add `memory.high` below `memory.max` — instead of dying instantly the pod gets throttling and aggressive reclaim, and you get a signal in advance.",
      "In the application: flush and delete temporary files as soon as processing ends; for streaming work, do not materialise the whole archive.",
      "Size the heap relative to the limit (`-XX:MaxRAMPercentage=60`, `GOMEMLIMIT`) so the runtime leaves room for everything else instead of assuming the whole 1 Gi belongs to it."
    ],
    trap: "Concluding that \"the heap is small, so there is no leak, so Kubernetes is to blame\" costs hours. The key is that `memory.max` counts *everything* the container produced, including file cache and tmpfs. Read `memory.stat`, not the runtime metrics."
  },
  "too-many-open-files": {
    tag: "Limits",
    q: "`Too many open files` exactly six hours after every restart",
    sym: "The service degrades reliably after a few hours of work, stops accepting connections, and logs `accept: too many open files`. A restart buys the same six hours. `ulimit -n` in the shell says 65535.",
    out: `$ journalctl -u api -n 3
api[3312]: http: Accept error: accept tcp [::]:8080: accept4: too many open files

$ ulimit -n            # this is MY shell limit, not the service one
65535

$ cat /proc/3312/limits | grep 'open files'
Max open files            1024                 4096                 files

$ ls /proc/3312/fd | wc -l
1024`,
    hyp: [
      "The service limit is not the one from the interactive shell: systemd does not inherit shell settings and `LimitNOFILE` is not set in the unit. **Confirmed by `/proc/PID/limits`.**",
      "A descriptor leak in the application — response bodies, files or database connections not closed. The growth over time supports it.",
      "Sockets piling up in CLOSE_WAIT because the application never calls `close()` after the peer sends FIN.",
      "The system-wide `fs.file-max` is exhausted — that would be ENFILE and would affect the whole host."
    ],
    diag: `# what exactly we are holding
$ ls -l /proc/3312/fd | awk '{print $11}' | sed 's/:.*//' | sort | uniq -c | sort -rn
   871 socket
    98 /var/lib/api/cache

$ ss -tanp | grep 3312 | awk '{print $1}' | sort | uniq -c
   812 CLOSE-WAIT
    41 ESTAB`,
    cause: "Two overlapping problems. First, `LimitNOFILE` was not set in the unit, so the service ran with the default of 1024 instead of 65535. Second, and the real one, 812 sockets sat in CLOSE-WAIT: the HTTP client to an external API did not close response bodies on error codes, so connections accumulated until the limit was hit.",
    fix: [
      "Right now: raise `LimitNOFILE=65535` in the unit (`systemctl edit api`) and restart — this postpones the problem without fixing the leak.",
      "The real fix is in the code: close the response body on every branch (`defer resp.Body.Close()` immediately after the error check, not after the status check), set timeouts and cap the outbound connection pool.",
      "CLOSE-WAIT is always an application bug, never a kernel tuning matter: the peer sent FIN and we do not close our side. No sysctl repairs that.",
      "Monitoring: `process_open_fds / process_max_fds` — a cheap metric that catches this whole class hours before the outage, plus a separate one for sockets in CLOSE-WAIT."
    ],
    trap: "Checking `ulimit -n` in your own shell and concluding the limit is generous. Service limits live in the systemd unit and are only visible through `/proc/PID/limits`. And having raised the limit, do not stop: without fixing the leak the outage returns in two days instead of six hours."
  },
  "conntrack-full": {
    tag: "Network",
    q: "One request in fifty times out while every metric is green",
    sym: "Clients report rare timeouts. The error rate is about 2% and only reproduces under load. Latency of successful requests is normal, CPU and memory are fine, backends are healthy, and the application logs contain no trace of these requests at all — they never arrive.",
    out: `$ dmesg -T | tail -3
[Wed Sep  9 14:22:07] nf_conntrack: nf_conntrack: table full, dropping packet
[Wed Sep  9 14:22:07] nf_conntrack: nf_conntrack: table full, dropping packet

$ cat /proc/sys/net/netfilter/nf_conntrack_count
262144
$ cat /proc/sys/net/netfilter/nf_conntrack_max
262144

$ conntrack -S | head -2
cpu=0 found=0 invalid=1204 insert=0 insert_failed=8821 drop=8821 early_drop=0`,
    hyp: [
      "The conntrack table is full: new connections are dropped silently, the client sees a timeout and the application sees nothing. **`count == max` and a growing `insert_failed` confirm it.**",
      "Packet loss between client and load balancer — check retransmits and interface counters.",
      "Accept queue overflow on the server — visible as `ListenOverflows` in `nstat`.",
      "Ephemeral port exhaustion on the client side — that would give a connection error rather than a timeout, and would be visible on the client."
    ],
    diag: `$ nstat -az | grep -E 'ListenOverflows|ListenDrops|TcpExtTCPTimeouts'
TcpExtListenOverflows           0
TcpExtTCPTimeouts             124

# what filled the table
$ conntrack -L 2>/dev/null | awk '{print $3}' | sort | uniq -c | sort -rn | head -3
241203 udp
  19871 tcp

$ conntrack -L -p udp 2>/dev/null | head -1
udp 17 29 src=10.42.3.8 dst=10.96.0.10 sport=41022 dport=53`,
    cause: "The node runs high-RPS pods, and kube-proxy in iptables mode creates a conntrack entry per connection, **including every UDP DNS query**. Because of `ndots:5` each external name resolution produced four or five UDP queries, each with its own entry and a 30-second timeout. A table of 262,144 entries filled in minutes.",
    fix: [
      "Right now: raise `nf_conntrack_max` and the hash table proportionally (`nf_conntrack_buckets = max/4`), and shorten `nf_conntrack_udp_timeout` and `nf_conntrack_tcp_timeout_established` (five days by default — absurd for a node with high turnover).",
      "Remove the source: `ndots:1` in the pod `dnsConfig` or a trailing dot on external names, plus a node-local DNS cache (NodeLocal DNSCache) which removes most of that UDP traffic anyway.",
      "Strategically: move to a data plane without conntrack on the hot path — IPVS or eBPF (Cilium) — which removes the class of problem entirely.",
      "Monitoring: the ratio `nf_conntrack_count / nf_conntrack_max` and `conntrack -S` (`insert_failed`, `drop`). A metric almost never present on default dashboards."
    ],
    trap: "These losses are invisible to every ordinary metric: the application does not know about them, the load balancer counts them as client timeouts, CPU and memory graphs are clean. The only signal lives in `dmesg` and the conntrack counters — which is why \"rare unexplained timeouts\" should send you there first."
  },
  "ephemeral-ports": {
    tag: "Network",
    q: "The service cannot open new connections to a backend at 500 rps",
    sym: "The proxy starts returning connection errors beyond roughly 470 requests per second to a single backend. The backend is barely loaded and the network is idle. The error is `cannot assign requested address`.",
    out: `$ ss -s
Total: 31204
TCP:   29817 (estab 412, closed 28932, orphaned 12, timewait 28901)

$ sysctl net.ipv4.ip_local_port_range
net.ipv4.ip_local_port_range = 32768	60999

$ ss -tan state time-wait dst 10.20.0.15 | wc -l
28114`,
    hyp: [
      "Ephemeral ports are exhausted: 28,231 ports in the range, TIME_WAIT lasting 60 seconds — a ceiling of about 470 new connections per second to **one** address and port. The numbers line up exactly. **Primary hypothesis.**",
      "Connections are not being reused: the client opens a new one per request instead of keep-alive.",
      "A socket leak in the client — but then ESTAB would grow, not TIME-WAIT.",
      "The backend closes first — then TIME_WAIT would sit on its side, not ours."
    ],
    diag: `# the connection tuple = (src IP, src port, dst IP, dst port).
# with one dst IP:port and one src IP, only source ports vary:
#   60999 - 32768 = 28231 ports / 60 s of TIME_WAIT ≈ 470 conn/s

$ curl -sv http://10.20.0.15/health 2>&1 | grep -i 'connection:'
< Connection: close     <-- the backend does not keep the connection alive`,
    cause: "The HTTP client in the proxy ran without a pool: `Connection: close` on the backend closed every connection, our host ended up being the side that initiated the close, and each connection left a TIME_WAIT for 60 seconds. As soon as the turnover exceeded the port range divided by 60, ports ran out.",
    fix: [
      "The right fix is **keep-alive and a connection pool**: drop `Connection: close` on the backend, configure `MaxIdleConnsPerHost` / `upstream keepalive` in the proxy. That cuts new connections by two orders of magnitude and solves the problem outright.",
      "Widen the port range: `net.ipv4.ip_local_port_range = 10240 65535` roughly doubles the headroom, but it is a delay, not a solution.",
      "`net.ipv4.tcp_tw_reuse=1` lets TIME_WAIT ports be reused for **outbound** connections (requires timestamps). Safe and appropriate in exactly this scenario.",
      "If there are several backends, add destination addresses: the connection tuple includes the destination IP, so two backends double the ceiling for free."
    ],
    trap: "Do not touch `net.ipv4.tcp_tw_recycle` — it is broken for clients behind NAT and **was removed from the kernel in 4.12**. The advice to enable it still circulates in blog posts from 2012, and in an interview it is a test of whether you read primary sources."
  },
  "pmtu-blackhole": {
    tag: "Network",
    q: "A `curl` of the headers works; downloading the file hangs forever",
    sym: "After WireGuard was enabled between sites some requests stopped working. `curl -I` (headers only) returns instantly, `curl -o file` stalls after a few kilobytes. Ping succeeds, the port is open, TLS completes.",
    out: `$ curl -I https://api.internal/v1/report
HTTP/1.1 200 OK
Content-Length: 8402113

$ curl -o /dev/null https://api.internal/v1/report
  % Total    % Received
  0  8.0M    0  5734    0 ... (hangs)

$ ping -c1 -M do -s 1472 api.internal
PING api.internal (10.30.0.9) 1472(1500) bytes of data.
ping: local error: message too long, mtu=1420

$ ping -c1 -M do -s 1392 api.internal
64 bytes from 10.30.0.9: icmp_seq=1 ttl=63 time=1.44 ms`,
    hyp: [
      "The tunnel MTU is below 1500 and the ICMP \"Fragmentation Needed\" message is being filtered somewhere — a PMTUD black hole: small packets pass, large ones are dropped silently. The behaviour matches exactly. **Primary hypothesis.**",
      "Packet loss in the network — then small packets would suffer too, and retransmits would show at every size.",
      "A problem in the application — ruled out because the hang depends on response size, not on the endpoint.",
      "Asymmetric routing with a stateful firewall — check with a trace in both directions."
    ],
    diag: `# probing for the real PMTU
$ for s in 1472 1440 1412 1392; do
    ping -c1 -M do -s $s -W1 api.internal >/dev/null 2>&1 \\
      && echo "ok  payload=$s  mtu=$((s+28))"
  done
ok  payload=1392  mtu=1420

$ ip link show wg0
4: wg0: <POINTOPOINT,NOARP,UP> mtu 1420`,
    cause: "WireGuard adds 60 bytes of overhead, so the effective tunnel MTU is 1420. The hosts kept advertising an MSS for MTU 1500 and sent full-size segments with the DF flag. An intermediate firewall blocked ICMP type 3 code 4, so the sender never learned the packet was too big and retransmitted it forever.",
    fix: [
      "Immediate and reliable: MSS clamping on the border device — `iptables -t mangle -A FORWARD -p tcp --syn -j TCPMSS --clamp-mss-to-pmtu`. Segments are then negotiated to match the real path MTU.",
      "Allow ICMP type 3 code 4 on firewalls — blocking it wholesale breaks PMTUD, and in IPv6 it breaks the network outright, since routers there never fragment.",
      "Make MTU consistent along the whole path, including the cluster CNI: an overlay on top of a tunnel subtracts overhead twice (VXLAN 50 + WireGuard 60), and that has to be accounted for explicitly.",
      "Check the other protocols: UDP services (DNS with EDNS0, QUIC) suffer from the same cause but present differently."
    ],
    trap: "The symptom \"small works, large hangs\" points almost unambiguously at MTU, and it is the cheapest thing in the world to check with one `ping -M do`. Without that check, incidents like this turn into multi-hour investigations of the application and TLS."
  },
  "dirty-writeback-spikes": {
    tag: "I/O",
    q: "Every 30 seconds latency jumps from 15 ms to 2 seconds",
    sym: "Regular, strictly periodic spikes on the p99 graph. The application and the database share a host. Between the spikes everything is perfect. CPU is flat, memory is free.",
    out: `$ iostat -xz 1 | grep -A2 nvme0n1
Device   r/s     w/s   rkB/s     wkB/s  await  aqu-sz  %util
nvme0n1  12.0    18.0   192.0     980.0   0.31    0.02    1.2
nvme0n1  10.0  8422.0   160.0 1180416.0  84.20   62.40   99.8   <-- the spike
nvme0n1  11.0    22.0   176.0    1120.0   0.29    0.02    1.4

$ sysctl vm.dirty_ratio vm.dirty_background_ratio vm.dirty_expire_centisecs
vm.dirty_ratio = 20
vm.dirty_background_ratio = 10
vm.dirty_expire_centisecs = 3000

$ grep -E 'Dirty|Writeback' /proc/meminfo
Dirty:          11238400 kB
Writeback:              0 kB`,
    hyp: [
      "Dirty pages accumulating and being flushed in one burst: with 64 GB of RAM, `dirty_ratio=20` allows up to 12.8 GB to pile up and then go out at once, blocking every writer. The periodicity and the `w/s` spike confirm it. **Primary hypothesis.**",
      "A database checkpoint — a related mechanism: PostgreSQL flushes its buffer pool on `checkpoint_timeout`. Check with `log_checkpoints`.",
      "A scheduled background job (backup, cron, rotation) — check whether the timing matches.",
      "A degrading disk — ruled out: between spikes `await` is 0.3 ms and the device is healthy."
    ],
    diag: `$ grep -c 'checkpoint complete' /var/log/postgresql/*.log
$ tail -1 /var/log/postgresql/postgresql.log
checkpoint complete: wrote 384021 buffers (73.2%); write=2.104 s, sync=1.882 s

# who is actually writing
$ biolatency -m 5 1     # bimodal distribution: 0-1 ms and 512-2048 ms`,
    cause: "The default `vm.dirty_ratio`/`dirty_background_ratio` are percentages of memory and on a 64 GB host allow gigabytes of dirty pages. At the same time PostgreSQL was finishing a checkpoint, flushing 73% of its buffer pool. The two bursts stacked: the disk queue grew to 62 and every synchronous write, commits included, had to wait.",
    fix: [
      "Cap dirty pages in bytes rather than percent: `vm.dirty_bytes` and `vm.dirty_background_bytes` (say 512 MB and 128 MB) — flushing becomes frequent and small instead of rare and explosive.",
      "Spread the checkpoint: `checkpoint_completion_target = 0.9` and a larger `max_wal_size`, so checkpoints are rarer but their writes are stretched out.",
      "Separate the workloads: WAL and data on different devices; better still, do not keep the database and the application on one disk.",
      "Monitoring: `Dirty` from `/proc/meminfo`, `await` and `aqu-sz` from `iostat`, `/proc/pressure/io`. A `biolatency` histogram shows the bimodality that an average hides completely."
    ],
    trap: "Averages are useless here: `%util` averaged over a minute will read about 5% and `await` about 3 ms. Periodic spikes are only visible at one-second granularity or in a histogram — so when someone says \"it is occasionally slow\", the first move is to raise the sampling rate."
  },
  "swap-thrashing": {
    tag: "Memory",
    q: "The server answers ping but SSH takes three minutes to connect",
    sym: "The host is formally alive: ping works, port 22 is open. SSH lets you in after minutes, any command takes tens of seconds. The application serves single-digit requests per second instead of thousands.",
    out: `$ vmstat 1 3
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa
 2 14  8290304  81232   1024  92416 41208 38122 42104 38200 8210 24102 3 18 4 75
 3 12  8322048  78104   1024  90112 43102 39884 44012 39100 8402 25011 2 19 3 76

$ cat /proc/pressure/memory
some avg10=98.12 avg60=97.44 avg300=91.02
full avg10=71.30 avg60=68.11 avg300=59.44

$ free -m
               total  used   free  shared  buff/cache  available
Mem:           16016 15602     79       0          89        112
Swap:          16383  8096   8287`,
    hyp: [
      "Thrashing: the working set does not fit in memory and the system swaps hot pages in and out continuously. `si/so` at 40 MB/s in both directions and PSI memory full at 71% settle it. **Primary hypothesis.**",
      "A memory leak in one of the processes — find which one grew.",
      "Page cache evicted so hard that even executable code is being read back from disk — a secondary effect that explains the slow SSH.",
      "A degrading disk — ruled out: there is I/O and it is being served, there is simply far too much of it."
    ],
    diag: `# who took the memory (sorted by RSS)
$ ps -eo rss,pid,comm --sort=-rss | head -4
 9821044  4412 java
  412208  1189 postgres

# swapped-out pages per process
$ awk '/VmSwap/{print FILENAME, $2}' /proc/*/status 2>/dev/null | sort -k2 -rn | head -3

$ dmesg -T | grep -i 'oom\\|killed' | tail`,
    cause: "The Java service was started without an explicit `-Xmx`, so the runtime sized its heap as a fraction of total host memory; together with the database on the same server the working set exceeded 16 GB. The system did not OOM-kill anything because swap let it \"keep working\" — and instead of a fast failure you get a slow agony, which is worse to operate.",
    fix: [
      "Right now: restart or kill the biggest consumer to regain control. On a host where even `ps` takes a minute, a hard reset is sometimes faster than waiting.",
      "Set explicit bounds: `-Xmx` for the JVM, `GOMEMLIMIT` for Go, cgroup limits for services (`MemoryMax=` in the unit). A process should hit its own boundary, not the host's.",
      "`memory.high` gives a soft threshold with throttling and reclaim before the hard limit — a warning instead of a death.",
      "Alert on `/proc/pressure/memory` (`full avg60`), not on percentage of memory used: used memory is normal, whereas time lost waiting for memory is a direct measure of degradation."
    ],
    trap: "\"Let us disable swap so it stops being slow\" is the wrong conclusion: without swap the same scenario becomes an OOM kill, and with it you get evicted executable code and degradation. Swap is not the cause but the symptom that the working set does not fit; the cure is limits and RAM, not `swapoff`."
  },
  "fork-enomem-threads": {
    tag: "Limits",
    q: "`fork: Cannot allocate memory` with 20 GB of free RAM",
    sym: "A CI agent stopped launching jobs. Any attempt to start a process as the `ci` user fails with a memory allocation error, while `free -g` shows 20 GB free and processes started as root work fine.",
    out: `$ sudo -u ci bash -c 'echo hi'
bash: fork: Cannot allocate memory

$ free -g
               total   used   free  available
Mem:              62     39     20        22

$ ps -eLf | wc -l
  31204
$ sysctl kernel.threads-max kernel.pid_max
kernel.threads-max = 31210
kernel.pid_max = 4194304

$ systemctl show user-1002.slice -p TasksMax
TasksMax=4915`,
    hyp: [
      "We hit a task-count limit, not a memory limit: `ENOMEM` from `fork` is also returned when `threads-max`, the cgroup `pids` limit or `RLIMIT_NPROC` is exhausted. `ps -eLf` at 31,204 against `threads-max` of 31,210 is too exact to be a coincidence. **Primary hypothesis.**",
      "The `TasksMax` of the user slice (systemd limits it by default) — the second likely cause, checked separately.",
      "Strict overcommit (`vm.overcommit_memory=2`) — then root processes would fail too.",
      "Address-space fragmentation or `vm.max_map_count` exhaustion — those present differently, as mmap errors."
    ],
    diag: `# who spawned all the threads
$ ps -eo nlwp,pid,user,comm --sort=-nlwp | head -4
 NLWP   PID USER   COMMAND
21044  8812 ci     java
  412  1204 root   containerd

# cgroup task limits
$ cat /sys/fs/cgroup/user.slice/user-1002.slice/pids.max
4915
$ cat /sys/fs/cgroup/user.slice/user-1002.slice/pids.current
4915`,
    cause: "A thread leak in a test java process: every job created a pool that was never shut down. Twenty-one thousand threads in one process consumed the system-wide `threads-max`, and the user slice additionally hit `TasksMax`. Memory had nothing to do with it — the `ENOMEM` return from `fork` is simply overloaded.",
    fix: [
      "Right now: kill the offending process; if you cannot even run `kill`, use an already-open root session or sysrq.",
      "Fix the thread leak in the application — pools should be bounded and reused, not created per job.",
      "Add a guard: `TasksMax=` in the service unit and `pids.max` in the cgroup, so a runaway process kills itself instead of the host. The same principle as a memory limit.",
      "Monitoring: `node_processes_threads` against `kernel.threads-max`, and `pids.current/pids.max` per cgroup."
    ],
    trap: "The error text points at memory and sends you the wrong way. A useful rule: `ENOMEM` from `fork` with free memory available is almost always a task limit (`threads-max`, `pids`, `RLIMIT_NPROC`), and one command tells you which."
  },
  "rolling-update-502": {
    tag: "Deploy",
    q: "Every rolling update gives 2–3% of requests a 502",
    sym: "The rollout looks green: pods come up, readiness passes, old ones are removed. But the ingress graph shows a burst of 502s during the rollout, about 2–3% of requests for a minute. Application logs are clean — those requests are not there.",
    out: `# nginx-ingress
2026/09/09 11:04:21 [error] upstream prematurely closed connection while reading
  response header from upstream, upstream: "http://10.42.5.19:8080/api/v1/orders"

$ kubectl get deploy api -o jsonpath='{.spec.template.spec}' | jq '.terminationGracePeriodSeconds, .containers[0].lifecycle'
30
null

$ kubectl exec api-old -- cat /proc/1/status | grep SigCgt
SigCgt: 0000000000000000`,
    hyp: [
      "A race between removal from Endpoints and the SIGTERM: node-level rules are updated asynchronously, so some requests arrive at a pod that is already closing. **Primary hypothesis — `lifecycle: null`, no preStop.**",
      "The application does not handle SIGTERM and dies instantly, cutting off in-flight requests. `SigCgt: 0` confirms there are no handlers at all.",
      "Keep-alive connections from the ingress outlive the removal from load balancing — the pod needs to send `GOAWAY`/`Connection: close`.",
      "A new pod takes traffic before it is genuinely ready — but then the errors would come from the new pod, not as broken connections."
    ],
    diag: `# the order of events when a pod is removed:
#  1. pod marked Terminating  →  2. in parallel: removal from Endpoints
#                                  AND SIGTERM sent to the container
#  3. kube-proxy / ingress update their rules — hundreds of ms later
# a request landing between 2 and 3 arrives at a dying pod

$ kubectl logs api-old --previous | tail -2
(empty - the process died before it could write anything)`,
    cause: "Two things coincided. The application, as PID 1 in the container, installed no SIGTERM handler, and the kernel does not apply default signal actions to PID 1 in a namespace — so the process did not terminate on SIGTERM at all and was killed with SIGKILL 30 seconds later, cutting everything in flight. At the same time there was no preStop hook, so the pod received the signal before the ingress stopped sending it traffic.",
    fix: [
      "Add `preStop: exec: [\"sleep\", \"10\"]` — the pod stays alive serving requests while the rules propagate to every node. The cheapest and most effective single change.",
      "In the application: catch SIGTERM, stop accepting new connections, finish the in-flight ones, close the pool and exit. `terminationGracePeriodSeconds` must exceed your longest request.",
      "For keep-alive: send `Connection: close` (HTTP/1.1) or `GOAWAY` (HTTP/2) when shutdown begins, otherwise the client keeps writing into a closing instance.",
      "Check that PID 1 really is your process and not a shell wrapper: `sh -c \"app\"` does not forward signals. Use `exec` in the entrypoint, or `--init`."
    ],
    trap: "The absence of errors in the application log is not an alibi here, it is evidence: the request never reached your code. And \"readiness passes, therefore the rollout is correct\" is wrong — readiness governs taking traffic, while correct shutdown is governed by preStop and signal handling, which readiness knows nothing about."
  },
  "nvme-util-misleading": {
    tag: "I/O",
    q: "Disk `%util` is 100% but the database is not disk-bound",
    sym: "The on-call sees `%util = 100%` on an NVMe and concludes the disk is saturated and storage must be scaled urgently. Meanwhile query latency is normal and throughput is half the device's rated figure.",
    out: `$ iostat -xz 1
Device   r/s     w/s   rkB/s   wkB/s  r_await  w_await  aqu-sz  %util
nvme0n1  38402  1204  614432   19264     0.09     0.14    3.42   100.0

$ cat /sys/block/nvme0n1/queue/nr_requests
1023
$ cat /sys/block/nvme0n1/queue/scheduler
[none] mq-deadline

$ nvme list | head -2
/dev/nvme0n1  ...  1.92 TB  (rated: 750k IOPS 4K random read)`,
    hyp: [
      "`%util` measures the fraction of time the queue is non-empty, which for devices serving dozens of commands in parallel is **not** a saturation measure. With `aqu-sz` at 3.4 and `await` at 0.09 ms the disk is clearly under-loaded. **Primary hypothesis — the metric is misleading.**",
      "The device really is saturated — refuted by the low `await`: at saturation service time would rise.",
      "We hit the application's queue depth rather than the device's — check how many parallel requests the database issues.",
      "A cloud disk IOPS cap or an exhausted burst balance — not applicable to a local NVMe, but always worth checking in a cloud."
    ],
    diag: `# an honest measurement of the device ceiling
$ fio --name=t --filename=/dev/nvme0n1 --rw=randread --bs=4k \\
      --iodepth=64 --numjobs=8 --direct=1 --runtime=30 --time_based --group_reporting
  read: IOPS=712k, BW=2782MiB/s, lat (usec): avg=89.4

# latency distribution instead of an average
$ biolatency -m 10 1
  0 -> 1 ms : 384021 |****************************************|
  2 -> 3 ms :    412 |                                        |`,
    cause: "A false alarm produced by a metric. `%util` is inherited from the era of spinning disks that served one command at a time, when 100% genuinely meant saturation. An NVMe serves thousands of commands in parallel, so a non-empty queue is reached at a few percent of real capacity. The disk was doing 38,000 IOPS against a ceiling of 712,000.",
    fix: [
      "Stop alerting on `%util` for NVMe and RAID. The working saturation signals are rising `await` (or `r_await`/`w_await`) at an unchanged workload profile, rising `aqu-sz`, and `/proc/pressure/io`.",
      "Build alerts on latency and pressure rather than utilisation: \"p99 disk wait above X\" answers whether anybody is suffering; `%util` does not.",
      "Know the real ceiling of your devices: take an `fio` profile resembling production (always `--direct=1`, otherwise you measure page cache) and keep it in the cluster documentation.",
      "In a cloud, check separately: the volume's IOPS and throughput quotas and the remaining burst balance — there 100% utilisation can be real, and it arrives suddenly, \"a week after launch\"."
    ],
    trap: "This is the inverse of the other cases: not missing a problem but inventing one and spending budget on \"scaling storage\". A good engineer is equally good at confirming a hypothesis and at refuting it — and here one `fio` run closes the question."
  },
  "clock-skew-cert": {
    tag: "Time",
    q: "Some nodes report `certificate verify failed` on a valid certificate",
    sym: "After the cluster was expanded, three new nodes cannot reach internal services over mTLS: `x509: certificate has expired or is not yet valid`. The certificate was issued an hour ago and is valid for 90 days. Older nodes are fine.",
    out: `$ openssl s_client -connect vault.internal:8200 2>/dev/null | openssl x509 -noout -dates
notBefore=Sep  9 08:12:00 2026 GMT
notAfter=Dec  8 08:12:00 2026 GMT

$ date -u
Wed Sep  9 07:44:11 UTC 2026     <-- 28 minutes in the past

$ chronyc tracking
Reference ID    : 00000000 ()
Stratum         : 0
System time     : 1680.223 seconds slow of NTP time
Leap status     : Not synchronised`,
    hyp: [
      "The node's clock is behind, so for it the certificate is \"not yet valid\" (`notBefore` in the future). A 28-minute gap with `notBefore` an hour ago fits. **Primary hypothesis.**",
      "A missing intermediate certificate in the chain — that would give a different error (`unable to get local issuer`).",
      "The CA is not trusted — again a different error.",
      "Time zone — irrelevant, comparison happens in UTC, but it is worth confirming `hwclock` is not off."
    ],
    diag: `$ chronyc sources -v
210 Number of sources = 0        <-- no sources at all

$ ss -lunp | grep 123
(empty - chronyd is not listening)

$ journalctl -u chronyd -n 3
chronyd: Could not open IPv4 command socket: Address already in use
chronyd: cannot connect to 10.0.0.1:123 (No route to host)`,
    cause: "On the new nodes the NTP port 123/UDP turned out to be closed by a security group — the network template for the new subnet was built without a rule for NTP. Chrony started, could not reach any source and never synchronised the clock; virtual-clock drift accumulated 28 minutes over the image's uptime.",
    fix: [
      "Right now: open 123/UDP to the NTP servers, then step the clock once (`chronyc makestep`) — with a large offset the normal slew would take days.",
      "Check the remaining new nodes and add a synchronisation check to the node-commissioning procedure: a node with unsynchronised clocks should not receive traffic.",
      "Monitoring: alert on the actual offset (`chrony_tracking_system_offset_seconds` / `node_timex_offset_seconds`) with a threshold of seconds, not on \"is the daemon running\".",
      "Remember how much depends on time beyond certificates: Kerberos (a five-minute window), JWT `exp` validation, cache and session TTLs, and correlation of logs and traces across hosts."
    ],
    trap: "An error mentioning a certificate pulls you into PKI: reissuing, checking chains, fixing the CA. A useful rule — on any unexplained certificate validation error, first compare `date -u` on client and server. Five seconds of work, and it closes a whole class of incidents."
  },
  "zombies-pid-limit": {
    tag: "Processes",
    q: "Zombies pile up in a container and after a day nothing will start",
    sym: "A service that runs an external tool (`ffmpeg`) per job starts failing to spawn subprocesses after about a day. `ps` inside the container shows hundreds of `<defunct>` entries.",
    out: `$ kubectl exec media-proc -- ps -eo stat,pid,comm | head -5
STAT   PID COMMAND
Ss       1 node
Z      412 ffmpeg <defunct>
Z      418 ffmpeg <defunct>
Z      423 ffmpeg <defunct>

$ kubectl exec media-proc -- sh -c 'ps -eo stat | grep -c Z'
3841

$ kubectl exec media-proc -- cat /sys/fs/cgroup/pids.max
4096`,
    hyp: [
      "The application is PID 1 in the namespace and never reaps its finished children: without `wait()` the entries stay as zombies and consume the PID limit. **Confirmed directly: PID 1 is node, and the zombies are its children.**",
      "A leak of actual processes (not zombies) — refuted by the `Z` state: they are already dead, only their status has not been collected.",
      "The host `pid_max` is exhausted — no, the limit is the pod cgroup's (4096 against 3841 zombies).",
      "A descriptor leak — that would produce a different error (EMFILE)."
    ],
    diag: `# zombies consume no CPU and no memory — only PID slots
$ kubectl exec media-proc -- cat /sys/fs/cgroup/pids.current
3927

# who the parent of the zombies is
$ kubectl exec media-proc -- ps -eo stat,pid,ppid,comm | awk '$1 ~ /^Z/ {print $3}' | uniq -c
   3841 1`,
    cause: "PID 1 in the container is the Node.js application, not an init. It launched `ffmpeg` and never called `wait()` or handled SIGCHLD, because on an ordinary system such orphans are inherited by the real init, which reaps them. Inside a PID namespace that duty falls on PID 1 — that is, on the application itself.",
    fix: [
      "Right now: restart the pod — the zombies disappear together with their parent. You cannot kill a zombie; it is already dead.",
      "The proper fix is a real init as PID 1: `tini`/`dumb-init` in the image, or `--init` in the runtime. It also solves signal forwarding on shutdown.",
      "In the code: handle `SIGCHLD` in a loop, `while (waitpid(-1, &st, WNOHANG) > 0)` — standard signals do not queue, so one signal may cover a batch of finished children.",
      "Guard rail: set `pids.max` for the pod so a runaway process hits its own limit rather than the node's."
    ],
    trap: "Zombies are often dismissed as harmless (\"they use no memory\") — true right up to the moment PID slots run out. The second effect of the same root cause: PID 1 in a namespace receives no default signal actions, so such a container also always ends up being SIGKILLed on timeout."
  },
  "softirq-single-core": {
    tag: "Network",
    q: "Latency rose for every service on a node with one core at 100%",
    sym: "On one cluster node every pod gained about 15 ms of latency. Total CPU utilisation is 30%, but `mpstat` shows CPU0 at 100%, of which 92% is `%soft`.",
    out: `$ mpstat -P ALL 1 1 | head -6
CPU    %usr  %sys  %iowait  %irq  %soft  %idle
all    22.1   6.4     0.2    0.1   4.2   67.0
  0     1.2   4.8     0.0    2.1  91.9    0.0
  1    24.0   6.1     0.2    0.0   0.4   69.3

$ cat /proc/interrupts | grep -E 'eth0|nvme' | awk '{print $1, $2, $NF}'
 46: 984201233 eth0-TxRx-0
 47:         0 eth0-TxRx-1

$ ethtool -l eth0
Current hw settings:
Combined:  1        <-- a single queue
Pre-set maximums:
Combined:  16`,
    hyp: [
      "All network processing (softirq) lands on one core: the interface has a single queue and all interrupts are pinned to CPU0. **Confirmed by `/proc/interrupts` and `ethtool -l`.**",
      "Simply a high packet rate — but with 16 queues it would spread across cores.",
      "An interrupt storm from a faulty device — check for a counter rising without matching traffic.",
      "NIC drops due to a small ring buffer — a secondary effect, check with `ethtool -S`."
    ],
    diag: `$ ethtool -S eth0 | grep -iE 'drop|miss|err' | grep -v ': 0'
rx_missed_errors: 41208
rx_no_buffer_count: 8821

$ sar -n DEV 1 1 | grep eth0
eth0   842011.00 rxpck/s  620104.00 txpck/s

$ cat /proc/net/softnet_stat | awk '{print $1, $2}' | head -3
3a1f9c21 00012f04     <-- second column: drops caused by backlog overflow`,
    cause: "The node was deployed from an image where the driver brought up a single combined queue instead of sixteen, and `irqbalance` was disabled in the template. At 840,000 packets per second one core could not keep up with softirq: the backlog queue overflowed, some packets were lost at the NIC and the rest waited — which is exactly the uniform +15 ms every pod on the node saw.",
    fix: [
      "Right now: enable multi-queue — `ethtool -L eth0 combined 16` — then spread the interrupts across cores (start `irqbalance`, or set affinity by hand via `/proc/irq/*/smp_affinity_list`).",
      "Grow the ring buffer if there are receive drops: `ethtool -G eth0 rx 4096`, and raise `net.core.netdev_max_backlog`.",
      "Enable RPS/RFS if there are fewer hardware queues than cores — software distribution across CPUs gives a similar effect.",
      "Fix the node image: NIC settings are part of the base configuration, otherwise the problem returns on every new node and looks like \"we happened to get a bad node\"."
    ],
    trap: "Total CPU at 30% looks perfectly healthy and an aggregated graph shows nothing. The rule: for any network anomaly look at CPU **per core** and at `%soft` separately — a bottleneck in one core under softirq is invisible in every averaged metric."
  },
  "configmap-stale-fd": {
    tag: "Config",
    q: "The config was updated; the service keeps using the old value",
    sym: "A timeout was changed in a ConfigMap and applied, and the file inside the container was confirmed updated. The application keeps using the old value. Restarting the pod fixes it.",
    out: `$ kubectl exec api -- cat /etc/app/config.yaml | grep timeout
timeout: 5s          <-- the new value is on disk

$ kubectl exec api -- ls -l /proc/1/fd | grep config
lr-x------ 1 root root 64 Sep 9 10:02 3 -> /etc/app/..2026_09_08_14_11_02.418/config.yaml (deleted)

$ kubectl exec api -- readlink /etc/app/config.yaml
..data/config.yaml`,
    hyp: [
      "The application read the config once at startup and still holds the old inode open — the file on disk was replaced by a symlink swap, but the open descriptor points at the previous version. **`(deleted)` in `/proc/1/fd` confirms it.**",
      "The application caches values in memory and never re-reads the file — functionally the same, and fixed the same way.",
      "Mounted via `subPath` — in that case the file inside the container is **never** updated (a known Kubernetes limitation), but here it was.",
      "The watcher uses inotify on the file name and missed the event: kubelet swaps the whole directory rather than writing into the file."
    ],
    diag: `# how kubelet updates a ConfigMap: it writes a new directory and atomically
# it swaps the ..data symlink -> ..2026_09_09_10_02_11.xxx
$ kubectl exec api -- ls -la /etc/app/
drwxrwxrwt  ..2026_09_09_10_02_11.771
lrwxrwxrwx  ..data -> ..2026_09_09_10_02_11.771
lrwxrwxrwx  config.yaml -> ..data/config.yaml

# inotify on config.yaml never fires: the file does not change, the symlink does`,
    cause: "Kubelet updates a mounted ConfigMap by atomically swapping a symlink to a new directory — exactly the same trick as `write + fsync + rename` on an ordinary system. The application opened the file at startup and its descriptor still refers to the previous version's inode. On top of that, the watcher used inotify on `config.yaml` and received no events, because the file itself never changed.",
    fix: [
      "Fast and predictable: do not rely on hot reload — treat a config change as a reason to restart. The standard trick is an annotation carrying a hash of the ConfigMap in the pod template, so changing the config triggers a rolling update by itself.",
      "If hot reload is genuinely needed: watch the directory rather than the file (`IN_MOVED_TO`, `IN_CREATE` on `/etc/app`) and **reopen** the file instead of reading from the old descriptor.",
      "Remember `subPath`: mounted that way, the file is never updated — only a pod restart helps. A common trap when mounting a single file into an existing directory.",
      "The same mechanism and the same trap exist outside Kubernetes: `sed -i` creates a new inode, so a daemon holding the file open keeps reading the old one — which is why configs are re-read on a signal (`SIGHUP`), not on a timer."
    ],
    trap: "\"The file on disk was updated, therefore it took effect\" is false: the application works with an open inode, not with a name. One command checks it — `ls -l /proc/PID/fd | grep deleted` — and it is the very same mechanism that keeps space from being freed after log rotation."
  },
  "crashloop-liveness": {
    tag: "Deploy",
    q: "The pod is in CrashLoopBackOff and the logs are empty",
    sym: "After a deploy the pod restarts endlessly. `kubectl logs` is empty and so is `--previous`. The pod description shows no errors, the image pulled, resources are available.",
    out: `$ kubectl get pod api-6b4 -o wide
NAME     READY  STATUS             RESTARTS  AGE
api-6b4  0/1    CrashLoopBackOff   7         6m

$ kubectl describe pod api-6b4 | grep -A4 'Last State'
    Last State:     Terminated
      Reason:       Error
      Exit Code:    137
      Started:      11:02:14
      Finished:     11:02:44

$ kubectl get events --field-selector involvedObject.name=api-6b4 | tail -2
11:02:44  Warning  Unhealthy  Liveness probe failed: Get "http://10.42.1.7:8080/health": context deadline exceeded
11:02:44  Normal   Killing    Container api failed liveness probe, will be restarted`,
    hyp: [
      "The container was SIGKILLed (137 = 128+9) but not for memory: the reason is `Error`, not `OOMKilled`. So kubelet killed it on a liveness probe. **Confirmed by the events.**",
      "A slow start: the application warms up longer than `initialDelaySeconds` and the probe kills it before it is ready. Living exactly 30 seconds is the characteristic signature.",
      "OOM — ruled out: that would say `Reason: OOMKilled`.",
      "The application crashing on its own — ruled out: the exit code would be 1 or 2 and something would be in the logs."
    ],
    diag: `$ kubectl get deploy api -o jsonpath='{.spec.template.spec.containers[0].livenessProbe}' | jq
{
  "httpGet": {"path": "/health", "port": 8080},
  "initialDelaySeconds": 5,
  "periodSeconds": 10,
  "timeoutSeconds": 1,
  "failureThreshold": 3
}
# 5 + 3x10 = 35 seconds before the kill; the app needs 45 to start

$ kubectl logs api-6b4 --previous --tail=-1
(empty - the app buffers stdout and never flushes before the kill)`,
    cause: "The application spent 45 seconds warming a cache and a connection pool, while the liveness probe started knocking after 5 seconds and killed the container at the 35th. The logs were empty because stdout was buffered and the buffer was lost on SIGKILL — which made the incident look more mysterious than it was.",
    fix: [
      "Separate the probes by role: **startupProbe** for a slow start (with a generous `failureThreshold`), **readiness** for taking traffic, **liveness** only for unrecoverable hangs and with lenient thresholds.",
      "An aggressively configured liveness probe is more dangerous than no probe at all: under load it restarts healthy but busy pods and turns degradation into an outage.",
      "Disable output buffering in the container (`PYTHONUNBUFFERED=1`, an unbuffered logger) — otherwise any SIGKILL costs you exactly the lines that explain the cause.",
      "Learn the codes: 137 = SIGKILL (OOM or a probe), 143 = SIGTERM (normal shutdown), 1/2 = an application error. That is the first thing to read in `Last State`."
    ],
    trap: "Empty logs push people to look for the problem in the image and the network. In reality the whole answer sits in `kubectl describe` and the events: code 137 with reason `Error` points unambiguously at a probe rather than at memory, and the investigation takes a minute instead of an hour."
  },
  "kernel-mitigations-cpu": {
    tag: "CPU",
    q: "After a kernel upgrade the service uses 30% more CPU",
    sym: "A routine kernel upgrade. Everything works, but CPU rose by roughly a third across all nodes at the same traffic, and some services now hit their limits. Rolling the kernel back restores the previous figures.",
    out: `$ uname -r
6.8.0-45-generic     (was 5.15.0-91-generic)

$ perf stat -p 4412 -- sleep 10
     18,204,112,884  cycles
      6,102,884,201  instructions   # 0.34 insn per cycle
         41,208,331  context-switches

$ perf top -p 4412 | head -5
  18.4%  [kernel]  entry_SYSCALL_64
  11.2%  [kernel]  __x86_indirect_thunk
   9.8%  [kernel]  switch_mm_irqs_off

$ grep . /sys/devices/system/cpu/vulnerabilities/* | head -3
spectre_v2:Mitigation: IBRS, IBPB conditional, RSB filling
spec_store_bypass:Mitigation: Speculative Store Bypass disabled
meltdown:Mitigation: PTI`,
    hyp: [
      "The new kernel enabled additional speculative-execution mitigations: every system call and context switch became more expensive. `entry_SYSCALL_64` and `switch_mm_irqs_off` at the top of the profile are the signature. **Primary hypothesis.**",
      "The service is syscall-heavy and therefore especially sensitive to exactly this — supported by 41 million context switches in 10 seconds.",
      "A scheduler regression (the CFS → EEVDF change in 6.6) — the second hypothesis, checked with the profile and `runqlat`.",
      "Changed sysctl or driver defaults after the upgrade — check with a diff of `sysctl -a` before and after."
    ],
    diag: `# how much time goes into the kernel, and on which calls
$ strace -c -p 4412 -f 2>&1 | head -6
%time  seconds  usecs/call  calls  syscall
 41.2   4.102        2      2051204  epoll_wait
 28.4   2.821        1      2820114  read
 19.1   1.902        1      1902441  write

# diff the mitigation set against the old kernel
$ diff <(ssh old-node 'grep . /sys/devices/system/cpu/vulnerabilities/*') \\
       <(grep . /sys/devices/system/cpu/vulnerabilities/*)`,
    cause: "The application makes millions of small system calls per second (one `read`/`write` per message). The new kernel enabled additional mitigations that make the user↔kernel transition more expensive: page-table switching, speculation barriers, RSB filling. For a syscall-heavy profile that produced exactly the 30%.",
    fix: [
      "The right direction is to make fewer system calls, not to disable protections: batching (`writev`, `sendmmsg`), bigger buffers, `io_uring` where applicable. That wins by a multiple and does not depend on the kernel version.",
      "Disabling mitigations (`mitigations=off`) exists, but it is a security decision rather than an operational one: it should not be made by the on-call, and only for isolated workloads running no untrusted code.",
      "Separate the hypotheses carefully: if EEVDF rather than mitigations is responsible, the picture differs (`runqlat`, distribution across cores) and the fix differs too.",
      "Process-wise: a kernel upgrade is a change like any deploy and deserves a canary with before/after metric comparison on part of the fleet."
    ],
    trap: "The temptation is to set `mitigations=off` immediately and close the ticket. That changes the threat model of the whole fleet for 30% of CPU and almost always has another solution. Equally important: do not stop at the first plausible hypothesis — the scheduler changed in the same release, and the profile must be read rather than guessed."
  }
};

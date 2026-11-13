/* animation.js – SVG scene builder + beat/packet engine. Pure simulation, no network. */
(function (root) {
  'use strict';
  var IP = root.PUBLIC_IP || '203.0.113.25';

  /* ---------- tiny SVG string helpers ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function box(x, y, w, h, cls, extra, rx) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx == null ? 10 : rx) + '" class="' + (cls || '') + '" ' + (extra || '') + '/>'; }
  function tx(x, y, s, cls, anchor) { return '<text x="' + x + '" y="' + y + '" class="svt ' + (cls || '') + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(s) + '</text>'; }
  function tm(x, y, s, cls) { return '<text x="' + x + '" y="' + y + '" class="tm ' + (cls || '') + '">' + esc(s) + '</text>'; }
  function bt(n, inner, attr) { return '<g class="bt" data-beat="' + n + '" ' + (attr || '') + '>' + inner + '</g>'; }
  function wrap(x, y, s, n, lh, cls, anchor) {
    var words = String(s).split(' '), lines = [], cur = '';
    words.forEach(function (w) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur); cur = w; } else { cur = (cur + ' ' + w).trim(); } });
    if (cur) lines.push(cur);
    return lines.map(function (l, i) { return tx(x, y + i * lh, l, cls, anchor); }).join('');
  }
  function path(id, d, cls) { return '<path id="' + id + '" d="' + d + '" class="wire ' + (cls || '') + '"/>'; }
  function pkt(pid, kind, dur, delay, pb, extra) { return '<circle r="6.5" class="pkt ' + kind + '" data-path="' + pid + '" data-dur="' + dur + '" data-delay="' + delay + '" data-pb="' + pb + '" ' + (extra || '') + '/>'; }
  function dots(x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="5" fill="#ff5f57"/><circle cx="' + (x + 16) + '" cy="' + y + '" r="5" fill="#febc2e"/><circle cx="' + (x + 32) + '" cy="' + y + '" r="5" fill="#28c840"/>'; }
  function chipIcon(x, y, s, col) { // little CPU-chip glyph
    var p = '';
    for (var i = 0; i < 4; i++) { p += '<rect x="' + (x + 6 + i * (s / 5)) + '" y="' + (y - 5) + '" width="3" height="5" fill="' + col + '"/><rect x="' + (x + 6 + i * (s / 5)) + '" y="' + (y + s) + '" width="3" height="5" fill="' + col + '"/>'; }
    return p + '<rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" rx="6" fill="' + col + '"/><rect x="' + (x + s * .28) + '" y="' + (y + s * .28) + '" width="' + (s * .44) + '" height="' + (s * .44) + '" rx="3" fill="#fff" opacity=".85"/>';
  }
  function bar(x, y, w, h, beat, cls, frac, label) {
    return bt(beat, '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '" class="track"/><rect x="' + x + '" y="' + y + '" width="' + (w * frac) + '" height="' + h + '" rx="' + h / 2 + '" class="fill ' + cls + '" data-beat="' + beat + '"/>' + (label ? tx(x, y - 5, label, 'xs dim') : ''));
  }

  /* ---------- the nine scenes. Each returns {svg, max, caps[0..max]} ---------- */
  var SCENES = {};

  SCENES[1] = function () {
    var rows = ['Open the AWS Management Console', 'Navigate to the EC2 service', 'Click “Launch instance”', 'AMI: Ubuntu Server 24.04 LTS', 'Instance type: t3.micro', 'Network: existing VPC + subnet', 'Storage: 8 GiB gp3 root volume', 'Key pair: my-key (.pem)', 'Launch instance'];
    var h = box(30, 50, 440, 470, 'panel') + '<rect x="30" y="50" width="440" height="38" rx="10" class="winbar"/>' + dots(50, 69) + tx(250, 74, 'AWS Management Console (simulated)', 'sm dim', 'middle');
    rows.forEach(function (r, i) {
      var y = 104 + i * 45;
      h += '<rect x="44" y="' + y + '" width="412" height="37" rx="8" class="rowhl" data-at="' + (i + 1) + '"/>' + tx(84, y + 24, (i + 1) + '. ' + r, 'sm');
      h += bt(i + 1, '<circle cx="64" cy="' + (y + 18) + '" r="10" class="okc"/><path d="M58.5 ' + (y + 18) + 'l4 4 8-8" class="okp"/>');
    });
    h += box(500, 50, 470, 470, 'region') + tx(520, 78, 'AWS Region: ap-south-1 (Mumbai), an example', 'b aws');
    h += box(520, 98, 218, 404, 'az') + tx(534, 120, 'Availability Zone ap-south-1a', 'sm acc');
    h += box(756, 98, 198, 404, 'az') + tx(770, 120, 'Availability Zone ap-south-1b', 'sm acc');
    h += box(534, 136, 190, 350, 'subnet') + tx(546, 158, 'Subnet 172.31.16.0/20', 'xs ok') + tx(546, 174, 'inside the default VPC', 'xs dim');
    h += box(770, 136, 168, 350, 'subnet') + tx(782, 158, 'Subnet 172.31.32.0/20', 'xs ok') + tx(782, 174, 'inside the default VPC', 'xs dim');
    h += tx(854, 320, 'Empty for now', 'sm dim', 'middle');
    h += path('p1', 'M458 482 C 520 482, 500 340, 560 318', 'flow');
    h += bt(9, box(556, 220, 160, 190, 'vm ubu') + chipIcon(610, 244, 54, '#e95420') + tx(636, 328, 'Ubuntu 24.04 LTS', 'b', 'middle') + tx(636, 348, 't3.micro · 2 vCPU · 1 GiB', 'xs dim', 'middle') + '<circle cx="580" cy="388" r="6" class="led warn"/>' + tx(592, 392, 'pending → running', 'xs warn'), 'class="float"');
    h += pkt('p1', 'ssh', 1500, 0, 9);
    return {
      svg: h, max: 9, caps: ['Step 1: renting a computer in the cloud. Watch the (simulated) console.', 'Open the AWS Management Console and sign in.', 'Go to the EC2 service.', 'Choose Launch instance.', 'Search the AMI catalog and pick Ubuntu Server 24.04 LTS.', 'Pick an instance type (t3.micro: availability depends on your account).', 'Select an existing VPC and subnet: this fixes the Availability Zone.', 'Configure the root EBS volume.', 'Select or create a key pair and download the .pem file.', 'Launch! The EC2 control plane builds your instance in the chosen AZ.']
    };
  };

  SCENES[2] = function () {
    var h = box(30, 346, 620, 190, 'hw') + tx(340, 528, 'Physical AWS host server (in a data center)', 'sm b dim', 'middle');
    ['Physical CPU', 'Physical RAM', 'NVMe / EBS', 'Network card'].forEach(function (n, i) {
      var x = 50 + i * 148;
      h += '<g class="lit" data-beat="1">' + box(x, 392, 132, 112, 'chip') + chipIcon(x + 38, 410, 56, '#ffb020') + tx(x + 66, 490, n, 'sm', 'middle') + '</g>';
    });
    h += bt(2, box(30, 266, 620, 62, 'hyp') + tx(340, 292, 'Hypervisor layer (AWS Nitro)', 'b', 'middle') + tx(340, 314, 'schedules vCPUs · maps memory · virtual disks & NICs · isolation', 'xs', 'middle'));
    h += path('a1', 'M116 392 L116 328', 'flow') + path('a2', 'M264 392 L264 328', 'flow') + path('a3', 'M412 392 L412 328', 'flow') + path('a4', 'M560 392 L560 328', 'flow');
    h += pkt('a1', 'ssh', 1200, 0, 3) + pkt('a2', 'ssh', 1200, 300, 3) + pkt('a3', 'ssh', 1200, 600, 3) + pkt('a4', 'ssh', 1200, 900, 3);
    var vms = [{ n: 'Amazon Linux VM', c: 'alx', x: 245, b: 3, cc: '#ff9900', f: [.5, .5] }, { n: 'Windows Server VM', c: 'win', x: 440, b: 3, cc: '#5b8cff', f: [.75, .6] }];
    vms.forEach(function (v) {
      h += bt(v.b, box(v.x, 62, 190, 190, 'vm ' + v.c) + tx(v.x + 95, 90, v.n, 'sm b', 'middle') + chipIcon(v.x + 73, 100, 44, v.cc) + bar(v.x + 16, 190, 158, 9, 3, 'aws', v.f[0], 'vCPU') + bar(v.x + 16, 218, 158, 9, 3, 'aws', v.f[1], 'Memory'));
    });
    h += bt(4, box(40, 62, 190, 190, 'vm ubu') + tx(135, 90, 'Ubuntu Server VM', 'sm b ubu', 'middle') + chipIcon(113, 100, 44, '#e95420'), 'class="bt pulse"');
    h += bt(3, bar(56, 190, 158, 9, 3, 'ubu', .5, 'vCPU (2)') + bar(56, 218, 158, 9, 3, 'ubu', .5, 'Memory (1 GiB)'));
    h += bt(5, '<rect x="50" y="152" width="170" height="20" rx="4" fill="#080b16"/>' + tm(58, 166, '[ OK ] kernel booted', 'g'));
    h += bt(6, '<rect x="70" y="232" width="130" height="18" rx="9" class="pill green"/>' + tx(135, 245, 'RUNNING ✔', 'xs ok', 'middle'));
    h += bt(2, box(672, 40, 298, 496, 'panel') + tx(686, 66, 'AWS Nitro System', 'b aws') + wrap(686, 86, 'Dedicated hardware + a lightweight hypervisor.', 40, 15, 'xs dim'));
    h += bt(3, box(686, 108, 270, 84, 'panel2') + tx(698, 130, 'Nitro Cards', 'sm b') + wrap(698, 148, 'VPC networking, EBS storage and instance storage handled on dedicated cards, not on the host CPU.', 38, 14, 'xs dim'));
    h += bt(4, box(686, 202, 270, 70, 'panel2') + tx(698, 224, 'Nitro Security Chip', 'sm b') + wrap(698, 242, 'Hardware root of trust. Locks down host firmware.', 38, 14, 'xs dim'));
    h += bt(5, box(686, 282, 270, 70, 'panel2') + tx(698, 304, 'Nitro Hypervisor', 'sm b') + wrap(698, 322, 'Lightweight, KVM-based: mostly CPU and memory isolation.', 38, 14, 'xs dim'));
    h += bt(6, box(686, 364, 270, 160, 'panel2') + tx(698, 386, 'Not every instance is the same', 'sm b warn') + wrap(698, 404, 'Older generations (for example T2, M4) use Xen-based virtualization. Current generations (T3, M5 and newer) run on Nitro. “.metal” sizes have no hypervisor at all: you get the bare server.', 38, 14, 'xs dim'));
    h += tx(340, 556, 'Apartment building = server · building manager = hypervisor · apartment = VM · tenant = Ubuntu', 'xs dim', 'middle');
    return {
      svg: h, max: 6, caps: ['Step 2: what is really behind “an instance”?', '1 · The physical hardware powers on: CPU, RAM, NVMe/EBS path, network.', '2 · The hypervisor / Nitro layer takes control of the resources.', '3 · Resources are carved into isolated virtual slices; other tenants’ VMs live here too.', '4 · Your Ubuntu virtual machine is created from the AMI.', '5 · The Ubuntu kernel boots and cloud-init injects your key.', '6 · The instance is operational. You never see the host, only your VM.']
    };
  };

  SCENES[3] = function () {
    var L = ['Instance family', 'vCPU', 'Memory (RAM)', 'EBS volume', 'Root filesystem', 'Key pair', 'VPC', 'Subnet', 'Public IP'];
    var V = ['t3 (burstable, general purpose)', '2 vCPU', '1 GiB', '8 GiB gp3 (EBS)', '/ (ext4) on /dev/root', 'my-key (.pem)', 'default VPC 172.31.0.0/16', 'ap-south-1a · 172.31.16.0/20', 'Auto-assign: Enabled'];
    var h = box(30, 40, 520, 492, 'panel') + tx(50, 68, 'Instance configuration', 'b lg');
    L.forEach(function (l, i) {
      var y = 84 + i * 48;
      h += '<rect x="44" y="' + y + '" width="492" height="40" rx="8" class="rowhl" data-at="' + (i + 1) + '"/>' + tx(60, y + 26, l, 'sm dim') + bt(i + 1, tx(236, y + 26, V[i], 'sm b ok'));
    });
    h += box(580, 40, 390, 292, 'panel') + tx(600, 68, 't3.micro · resources', 'b lg');
    h += bt(2, tx(600, 100, 'vCPU', 'xs dim') + box(600, 108, 56, 36, 'chip') + box(664, 108, 56, 36, 'chip') + tx(630, 132, 'core', 'xs', 'middle') + tx(692, 132, 'core', 'xs', 'middle'));
    h += bar(600, 178, 350, 14, 3, 'aws', .35, 'Memory 1 GiB');
    h += bar(600, 222, 350, 14, 4, 'ubu', .28, 'EBS root volume 8 GiB (gp3)');
    h += bt(9, tx(600, 266, 'Private IP 172.31.24.87 → Public IP ' + IP, 'xs mono ok') + tx(600, 286, 'ENI in subnet · key pair my-key attached', 'xs dim'));
    h += box(580, 346, 390, 186, 'panel') + tx(600, 374, 'Instance state', 'b lg');
    h += bt(10, '<rect x="600" y="388" width="110" height="30" rx="15" class="pill amber"/><circle cx="620" cy="403" r="6" class="led warn"/>' + tx(634, 408, 'Pending', 'xs warn') + '<circle cx="940" cy="360" r="9" fill="none" stroke="var(--warn)" stroke-width="3" stroke-dasharray="14 8" class="spin"/>');
    h += bt(11, tx(720, 408, '→', 'b dim') + '<rect x="740" y="388" width="110" height="30" rx="15" class="pill green"/><circle cx="760" cy="403" r="6" class="led ok"/>' + tx(774, 408, 'Running', 'xs ok'));
    h += bt(12, '<rect x="600" y="436" width="350" height="82" rx="10" class="panel2"/>' + tx(616, 460, 'Status checks', 'sm b') + tx(616, 482, '✔ System status check: passed', 'xs ok') + tx(616, 502, '✔ Instance status check: passed  (2/2)', 'xs ok'));
    return {
      svg: h, max: 12, caps: ['Step 3: customize your virtual computer before “moving in”.', 'Pick the instance family: t3.', 'vCPU: 2 virtual cores.', 'Memory: 1 GiB RAM.', 'Attach an 8 GiB gp3 EBS volume.', 'The root filesystem lives on that volume.', 'Choose the key pair for SSH.', 'Choose the VPC.', 'Choose the subnet (this pins the Availability Zone).', 'Enable public IP auto-assignment.', 'State: Pending, AWS is placing and booting your instance.', 'State: Running.', 'Status checks 2/2 passed: AWS and the OS both respond.']
    };
  };

  SCENES[4] = function () {
    var h = '<path d="M60 360c-30 0-40-40-10-55-5-40 50-50 72-22 24-26 70-8 62 26 28 6 26 48-6 51z" class="cloud"/>' + tx(120, 326, 'Internet', 'b', 'middle') + tx(120, 344, 'everyone', 'xs dim', 'middle');
    h += box(390, 50, 230, 470, 'shield', 'data-beat="1"') + tx(505, 80, '🛡 Security Group', 'b', 'middle') + tx(505, 98, 'stateful virtual firewall', 'xs dim', 'middle');
    h += box(740, 230, 230, 200, 'vm ubu') + chipIcon(822, 250, 56, '#e95420') + tx(855, 332, 'EC2 · Ubuntu', 'b', 'middle') + tx(855, 352, 'private IP 172.31.24.87', 'xs dim mono', 'middle') + tx(855, 380, 'sshd :22  ·  nginx :80', 'xs mono ok', 'middle');
    var R = [['SSH', '22', 'My IP /32', 1, 'amber'], ['HTTP', '80', '0.0.0.0/0', 2, 'green'], ['HTTPS', '443', '0.0.0.0/0', 3, 'green']];
    h += tx(406, 124, 'INBOUND RULES (default: deny)', 'xs dim');
    R.forEach(function (r, i) {
      var y = 134 + i * 34;
      h += '<rect x="402" y="' + y + '" width="198" height="28" rx="8" class="rowhl" data-at="' + r[3] + '"/>' + bt(r[3], '<rect x="402" y="' + y + '" width="198" height="28" rx="8" class="pill ' + r[4] + '"/>' + tx(412, y + 19, r[0] + ' ' + r[1], 'xs b') + tx(590, y + 19, r[2], 'xs mono', 'end'));
    });
    h += bt(4, tx(406, 262, 'Outbound: all allowed', 'xs dim') + tx(406, 280, 'Replies auto-allowed (stateful)', 'xs dim') + tx(406, 298, 'Everything else → DENY', 'xs bad'));
    var lanes = [[345, 'http', 'ok'], [390, 'ssh', 'ssh'], [435, 'sql', 'bad'], [480, 'x', 'bad']];
    h += path('l1', 'M200 345 L740 345') + path('l2', 'M200 390 L740 390') + path('l3', 'M200 435 L740 435') + path('l4', 'M200 480 L740 480');
    h += bt(4, tx(214, 337, 'HTTP :80 from anyone', 'xs ok') + tx(214, 382, 'SSH :22 from my IP', 'xs warn') + tx(214, 427, 'MySQL :3306 (attacker)', 'xs bad') + tx(214, 472, 'SSH :22 unknown IP', 'xs bad'));
    h += pkt('l1', 'ok', 2600, 0, 4) + pkt('l1', 'ok', 2600, 1300, 4) + pkt('l2', 'ssh', 2600, 500, 4) + pkt('l2', 'ssh', 2600, 1800, 4);
    h += pkt('l3', 'bad', 2600, 200, 5, 'data-stop="0.352"') + pkt('l3', 'bad', 2600, 1500, 5, 'data-stop="0.352"') + pkt('l4', 'bad', 2600, 900, 5, 'data-stop="0.352"') + pkt('l4', 'bad', 2600, 2200, 5, 'data-stop="0.352"');
    h += bt(5, tx(380, 440, '✖', 'lg bad', 'end') + tx(380, 485, '✖', 'lg bad', 'end'));
    h += pkt('l1', 'res', 2600, 650, 6, 'data-rev="1"') + pkt('l2', 'res', 2600, 1150, 6, 'data-rev="1"');
    h += bt(6, tx(676, 372, '↩ replies return', 'xs ok', 'middle'));
    return {
      svg: h, max: 6, caps: ['Step 4: a security guard stands between the internet and your instance.', 'Rule 1: SSH (22) only from your own public IP, using a /32 CIDR.', 'Rule 2: HTTP (80) from anywhere so the website is public.', 'Rule 3: HTTPS (443) from anywhere (only useful once TLS is configured).', 'Matching traffic is allowed through.', 'Traffic with no matching rule is silently dropped (the default is deny).', 'Stateful: replies to allowed requests need no outbound rule.']
    };
  };

  SCENES[5] = function () {
    var h = box(30, 60, 340, 420, 'panel') + dots(50, 80) + tx(200, 85, 'your laptop · terminal', 'xs dim', 'middle') + box(44, 98, 312, 368, 'term-box');
    h += bt(1, tm(56, 124, '$ chmod 400 key.pem', 'w') + tm(56, 144, '$ ls -l key.pem', 'w') + tm(56, 162, '-r-------- 1 you you key.pem', 'g') + tm(56, 180, '  ↑ only you can read the key', 'd'));
    h += bt(2, tm(56, 208, '$ ssh -i key.pem', 'w') + tm(56, 226, '    ubuntu@' + IP, 'w'));
    h += bt(5, tm(56, 254, 'Authenticated to ' + IP, 'g') + tm(56, 272, 'using "publickey".', 'g'));
    h += bt(7, tm(56, 300, 'Welcome to Ubuntu 24.04.1 LTS', 'y') + tm(56, 322, 'ubuntu@ip-172-31-24-87:~$', 'g') + '<rect x="228" y="312" width="9" height="14" fill="#46e08c" class="blinkc"/>');
    h += path('s1', 'M372 270 L636 270') + bt(6, path('s1b', 'M372 270 L636 270', 'tunnel'));
    h += box(445, 190, 80, 160, 'gate', 'data-beat="4"') + tx(485, 238, 'SG', 'b', 'middle') + tx(485, 258, 'port 22', 'xs', 'middle') + bt(4, tx(485, 300, '✔ ALLOW', 'xs ok', 'middle'));
    h += pkt('s1', 'ssh', 1700, 0, 3);
    h += bt(5, tx(504, 150, '🔑 challenge signed with', 'xs warn', 'middle') + tx(504, 166, 'private key → verified', 'xs warn', 'middle') + pkt('s1', 'key', 1700, 400, 5, 'data-rev="1"'));
    h += box(640, 60, 330, 420, 'panel') + tx(805, 88, 'EC2 · Ubuntu 24.04', 'b ubu', 'middle');
    h += bt(3, box(660, 110, 290, 60, 'panel2') + tx(676, 135, 'sshd listening on :22', 'sm b') + tx(676, 156, 'OpenSSH server', 'xs dim'));
    h += bt(5, box(660, 184, 290, 60, 'panel2') + tx(676, 208, '~/.ssh/authorized_keys', 'sm b mono') + tx(676, 228, 'holds your PUBLIC key (cloud-init)', 'xs dim'));
    h += bt(7, box(660, 260, 290, 200, 'term-box') + tm(672, 286, 'Welcome to Ubuntu 24.04.1 LTS', 'y') + tm(672, 308, 'ubuntu@ip-172-31-24-87:~$', 'g') + tm(672, 330, '(you are now inside your', 'd') + tm(672, 346, ' cloud computer)', 'd'));
    h += bt(6, tx(504, 420, 'Encrypted SSH tunnel', 'sm warn', 'middle'));
    h += bt(1, '<g class="float">' + '<circle cx="120" cy="436" r="10" fill="#ffe27a"/><rect x="128" y="432" width="38" height="8" fill="#ffe27a"/><rect x="154" y="440" width="6" height="8" fill="#ffe27a"/>' + '</g>' + tx(190, 441, 'key.pem: never share it', 'xs warn'));
    return {
      svg: h, max: 7, caps: ['Step 5: remotely entering your cloud computer.', '1 · Lock down the private key: chmod 400 key.pem.', '2 · Start the SSH connection request.', '3 · The packet travels to port 22 of your instance.', '4 · The Security Group matches the port-22 rule and allows it.', '5 · Public-key authentication: you prove you own the private key.', '6 · An encrypted tunnel is established.', '7 · The Ubuntu shell opens. You are logged in as ubuntu.']
    };
  };

  SCENES[6] = function () {
    var h = box(30, 40, 940, 492, 'panel') + tx(50, 70, 'Ubuntu 24.04 LTS · ip-172-31-24-87', 'b lg ubu');
    h += bt(1, '<rect x="50" y="86" width="200" height="40" rx="20" class="pill green"/>' + tx(150, 112, '👤 user: ubuntu (sudo)', 'sm b', 'middle'));
    h += bt(2, box(50, 144, 300, 230, 'term-box') + tm(66, 172, '/', 'w') + tm(66, 192, '├─ home/ubuntu  ← you are here', 'g') + tm(66, 212, '├─ etc/      configuration', 'd') + tm(66, 232, '├─ var/      logs, www/html', 'd') + tm(66, 252, '├─ usr/      programs', 'd') + tm(66, 272, '├─ bin/ sbin/ commands', 'd') + tm(66, 292, '├─ tmp/      temp files', 'd') + tm(66, 312, '└─ proc/ sys/ kernel views', 'd') + tx(200, 396, 'Linux filesystem: one tree, root = /', 'xs dim', 'middle'));
    h += bt(3, box(370, 86, 584, 40, 'panel2') + tx(386, 112, 'Kernel 6.8.0-aws · Ubuntu 24.04.1 LTS (noble) · x86_64', 'sm mono'));
    [['CPU', 3, 'CPU 3%', 'aws', '268'], ['Memory', 20, '187 / 914 MiB', 'ubu', '221'], ['Disk /', 28, '1.9 / 6.8 GiB', 'ok', '199']].forEach(function (g, i) {
      var cx = 440 + i * 170;
      h += bt(4, '<circle cx="' + cx + '" cy="226" r="44" class="gauge-bg"/><circle cx="' + cx + '" cy="226" r="44" class="gauge" style="--off:' + g[4] + ';stroke:var(--' + (g[3] === 'ok' ? 'ok' : g[3] === 'aws' ? 'aws' : 'ubuntu') + ')" data-beat="4"/>' + tx(cx, 232, g[1] + '%', 'b', 'middle') + tx(cx, 296, g[0], 'sm b', 'middle') + tx(cx, 314, g[2], 'xs dim', 'middle'));
    });
    h += bt(5, box(370, 340, 584, 110, 'panel2') + tx(386, 366, 'Network interfaces', 'sm b') + tx(386, 390, 'lo     127.0.0.1/8          (loopback)', 'xs mono') + tx(386, 410, 'ens5   172.31.24.87/20      (private IP)', 'xs mono ok') + tx(386, 430, '       ↔ public ' + IP + ' (AWS NAT)', 'xs mono warn'));
    h += bt(6, '<rect x="370" y="468" width="584" height="40" rx="10" class="pill amber"/>' + tx(662, 494, '⌨ Try these commands in the interactive terminal below ↓', 'sm b', 'middle'), 'class="bt pulse"');
    return {
      svg: h, max: 6, caps: ['Step 6: explore your newly created cloud computer.', 'You are the “ubuntu” user, with sudo rights for admin tasks.', 'The Linux filesystem is one tree that starts at / (root).', 'The kernel and OS version identify your server.', 'CPU, memory and disk usage at a glance.', 'The network card ens5 holds your private IP; AWS maps it to the public IP.', 'Your turn: run the commands in the terminal below.']
    };
  };

  SCENES[7] = function () {
    var h = box(30, 50, 520, 470, 'panel') + tx(50, 80, 'Ubuntu 24.04 · apt (package manager)', 'b ubu');
    var rows = [['sudo apt update', 'Download package lists', 1, 2, 'aws'], ['sudo apt upgrade -y', 'Install newer versions', 3, 4, 'ubu'], ['sudo apt install nginx -y', 'Install the web server', 5, 6, 'ngx']];
    rows.forEach(function (r, i) {
      var y = 118 + i * 74;
      h += bt(r[2], tm(50, y, '$ ' + r[0], 'w') + tx(50, y + 22, r[1], 'xs dim') + bar(50, y + 32, 400, 12, r[2], r[4], 1, '') + '<rect x="50" y="' + (y + 32) + '" width="400" height="12" rx="6" fill="none"/>');
    });
    rows.forEach(function (r, i) { var y = 118 + i * 74; h += bt(r[3], '<circle cx="486" cy="' + (y + 38) + '" r="11" class="okc"/><path d="M480.500 ' + (y + 38) + 'l4 4 8-8" class="okp"/>'); });
    h += box(50, 346, 480, 150, 'panel2') + tx(66, 372, 'Installed software', 'sm b') + tx(66, 396, '· base system, openssh-server, cloud-init …', 'xs dim');
    h += bt(7, box(66, 410, 210, 70, 'ngx-tile') + tx(171, 440, 'nginx 1.24.0', 'sm b', 'middle') + tx(171, 460, '● starting…', 'xs warn', 'middle'));
    h += bt(8, box(66, 410, 210, 70, 'ngx-tile') + tx(171, 440, 'nginx 1.24.0', 'sm b', 'middle') + '<circle cx="118" cy="458" r="5" class="led ok"/>' + tx(130, 462, 'active · listening :80', 'xs ok'));
    h += bt(5, tx(300, 430, 'Dependencies:', 'xs dim') + tx(300, 448, 'nginx-common', 'xs mono') + tx(300, 464, 'libnginx-mod-*', 'xs mono'));
    h += '<path d="M730 100c-34 0-44-42-10-58 4-44 60-52 84-22 26-28 76-8 66 28 30 8 26 50-8 52z" class="cloud" transform="translate(0 40)"/>';
    h += tx(838, 166, 'Ubuntu archive mirror', 'b', 'middle') + tx(838, 186, 'ap-south-1.ec2.archive.ubuntu.com', 'xs dim', 'middle') + tx(838, 206, '(repository)', 'xs dim', 'middle');
    h += path('r1', 'M740 270 L552 270', 'flow') + path('r2', 'M740 330 L552 330', 'flow');
    h += pkt('r1', 'res', 1300, 0, 1) + pkt('r1', 'res', 1300, 650, 1) + pkt('r2', 'ssh', 1500, 0, 3) + pkt('r2', 'ssh', 1500, 750, 3);
    h += bt(1, tx(646, 258, 'package lists', 'xs ok', 'middle')) + bt(3, tx(646, 318, '.deb packages', 'xs warn', 'middle'));
    h += bt(5, box(620, 360, 340, 150, 'panel2') + tx(634, 386, 'Why a web server?', 'sm b') + wrap(634, 406, 'Browsers speak HTTP. NGINX listens on port 80, finds the requested file on disk and sends it back.', 42, 15, 'xs dim'));
    return {
      svg: h, max: 8, caps: ['Step 7: turning the server into a website host.', '1 · apt update downloads the latest package lists from the repository.', '2 · The local package index is refreshed.', '3 · apt upgrade downloads newer versions of installed packages.', '4 · Upgrades installed.', '5 · apt install nginx resolves dependencies and downloads them.', '6 · NGINX is unpacked and configured.', '7 · systemd starts NGINX; it begins listening on port 80.', '8 · NGINX is installed and active.']
    };
  };

  SCENES[8] = function () {
    var N = [['Browser', 'visitor'], ['Internet', 'routes packets'], ['Public IP', IP], ['Security Group', 'port 80 ✔'], ['EC2 Ubuntu', '172.31.24.87'], ['NGINX', 'listens :80'], ['Website files', '/var/www/html']];
    var h = tx(490, 70, 'One page view = one request and one response', 'b lg', 'middle') + tx(490, 94, 'Follow the packet from the visitor’s browser to the file on disk and back', 'sm dim', 'middle');
    h += path('q1', 'M80 300 L900 300') + path('q2', 'M900 330 L80 330');
    N.forEach(function (n, i) {
      var x = 20 + i * 138;
      h += bt(i + 1, box(x, 120, 120, 120, 'node' + (i === 5 ? ' ngx' : ''), 'data-beat="' + (i + 1) + '"') + tx(x + 60, 168, n[0], 'sm b', 'middle') + tx(x + 60, 190, n[1], 'xs dim' + (i === 2 ? ' mono' : ''), 'middle') + tx(x + 60, 222, ['🖥', '🌐', '📍', '🛡', '🐧', '⚙', '📁'][i], 'lg', 'middle'));
      if (i) h += bt(i + 1, '<path d="M' + (x - 18) + ' 180 L' + (x - 2) + ' 180" stroke="var(--accent)" stroke-width="3" marker-end="none"/>');
    });
    h += bt(2, tx(490, 290, 'HTTP request: GET / HTTP/1.1', 'xs acc', 'middle'));
    h += bt(7, tx(490, 358, 'HTTP response: 200 OK + index.html, style.css, script.js, images', 'xs ok', 'middle'));
    h += pkt('q1', 'req', 3200, 0, 2, '') + pkt('q1', 'req', 3200, 1600, 2) + pkt('q2', 'res', 3200, 800, 7) + pkt('q2', 'res', 3200, 2400, 7);
    h += bt(2, box(20, 380, 430, 140, 'term-box') + tm(34, 406, 'GET / HTTP/1.1', 'w') + tm(34, 424, 'Host: ' + IP, 'd') + tm(34, 442, 'Accept: text/html', 'd') + tm(34, 470, 'HTTP/1.1 200 OK', 'g') + tm(34, 488, 'Server: nginx/1.24.0 (Ubuntu)', 'g') + tm(34, 506, 'Content-Type: text/html', 'g'));
    h += bt(6, box(470, 380, 240, 140, 'panel2') + tx(486, 406, '/var/www/html/', 'sm b mono') + tm(486, 430, '├─ index.html', 'g') + tm(486, 448, '├─ style.css', 'g') + tm(486, 466, '├─ script.js', 'g') + tm(486, 484, '└─ assets/', 'g'));
    h += bt(8, box(730, 380, 250, 140, 'vm') + '<rect x="740" y="390" width="230" height="120" rx="6" fill="#0b0b0f"/><text x="755" y="418" font-family="sans-serif" font-weight="800" font-size="14" fill="#e50914">CLOUDFLIX</text><rect x="755" y="430" width="125" height="10" rx="3" fill="#fff" opacity=".85"/><rect x="755" y="446" width="80" height="6" rx="3" fill="#888"/><rect x="755" y="466" width="46" height="36" rx="3" fill="#e50914"/><rect x="806" y="466" width="46" height="36" rx="3" fill="#3a5bd9"/><rect x="857" y="466" width="46" height="36" rx="3" fill="#e9a420"/><rect x="908" y="466" width="46" height="36" rx="3" fill="#18a999"/>');
    h += bt(8, tx(855, 540, '🌐 the visitor sees the live site', 'xs ok', 'middle'));
    return {
      svg: h, max: 8, caps: ['Step 8: your cloud computer becomes a live website server.', '1 · A visitor types http://' + IP + ' in the browser.', '2 · The request travels across the internet…', '3 · …to the instance’s public IP at the AWS edge of your VPC…', '4 · …is checked by the Security Group (port 80 allowed)…', '5 · …and reaches the Ubuntu instance…', '6 · …where NGINX is listening on port 80.', '7 · NGINX reads index.html, style.css, script.js and assets from /var/www/html and answers 200 OK.', '8 · The browser renders the page: the site is live!']
    };
  };

  var HK = [['ec2', 'EC2 instance'], ['ssh', 'SSH connection'], ['ubuntu', 'Ubuntu OS'], ['nginx', 'NGINX service'], ['http', 'HTTP port 80'], ['site', 'Website']];
  var health = {}; var healthMsg = 'All systems operational';
  function resetHealth() { HK.forEach(function (k) { health[k[0]] = ['ok', 'OK']; }); healthMsg = 'All systems operational'; }
  resetHealth();
  SCENES[9] = function () {
    var h = '';
    HK.forEach(function (k, i) {
      var x = 40 + (i % 3) * 312, y = 50 + Math.floor(i / 3) * 150, st = health[k[0]] || ['ok', 'OK'];
      h += bt(i + 1, '<rect x="' + x + '" y="' + y + '" width="290" height="126" rx="14" class="hcard ' + st[0] + '" id="hc-' + k[0] + '"/><circle cx="' + (x + 30) + '" cy="' + (y + 36) + '" r="9" class="led ' + st[0] + '" id="hl-' + k[0] + '"/>' + tx(x + 52, y + 42, k[1], 'b') + '<text x="' + (x + 24) + '" y="' + (y + 82) + '" class="svt sm ' + (st[0] === 'ok' ? 'ok' : st[0] === 'bad' ? 'bad' : 'warn') + '" id="ht-' + k[0] + '">' + esc(st[1]) + '</text>');
    });
    h += box(40, 360, 912, 160, 'panel') + tx(60, 390, '🚀 Control room', 'b lg') + '<text id="hmsg" x="60" y="424" class="svt b ' + (healthMsg.indexOf('operational') >= 0 ? 'ok' : 'bad') + '">' + esc(healthMsg) + '</text>';
    h += tx(60, 452, 'Pick an incident below, diagnose it, fix it, then verify. Every incident turns the matching tile red.', 'xs dim');
    h += tx(60, 474, 'Method: Is the instance running? → Can I reach port 22/80? → Is the service up? → Are files + permissions right?', 'xs dim');
    h += tx(60, 496, 'Work outside-in (SG, IP, state) and inside-out (systemctl, logs, curl localhost).', 'xs dim');
    return {
      svg: h, max: 6, caps: ['Step 9: become a Cloud Support Engineer.', 'Check 1: is the EC2 instance running?', 'Check 2: can you SSH in?', 'Check 3: is Ubuntu healthy (disk, memory)?', 'Check 4: is NGINX active?', 'Check 5: is port 80 reachable?', 'Check 6: does the website load? Now try the 12 incidents below.']
    };
  };

  /* ---------- engine ---------- */
  var svg, scene, cur = 0, beat = 0, max = 0, caps = [], timer = null, raf = null, listeners = [], paused = false;
  var reduce = false, healthL = [];
  try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  function q(sel) { return Array.prototype.slice.call(scene.querySelectorAll(sel)); }
  function emit() { listeners.forEach(function (f) { try { f({ step: cur, beat: beat, max: max, caption: caps[beat] || '' }); } catch (e) { /* ignore */ } }); }
  function setBeat(b) {
    beat = b;
    q('[data-beat]').forEach(function (el) { el.classList.toggle('on', +el.getAttribute('data-beat') <= b); });
    q('[data-at]').forEach(function (el) { el.classList.toggle('on', +el.getAttribute('data-at') === b); });
    emit();
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function show(n) {
    stopTimer(); cur = n; var def = SCENES[n]();
    scene.innerHTML = def.svg; max = def.max; caps = def.caps; beat = 0; setBeat(0);
    if (reduce) { setBeat(max); return; }
    var iv = Math.max(380, Math.min(620, Math.round(4200 / max)));
    timer = setInterval(function () { if (paused) return; if (beat < max) setBeat(beat + 1); else stopTimer(); }, iv);
    setTimeout(function () { if (cur === n && beat === 0) setBeat(1); }, 250);
  }
  function frame(now) {
    var pk = scene ? scene.querySelectorAll('.pkt') : [];
    for (var i = 0; i < pk.length; i++) {
      var el = pk[i], pb = +el.getAttribute('data-pb');
      if (beat < pb) { el.style.display = 'none'; continue; }
      var p = scene.querySelector('#' + el.getAttribute('data-path')); if (!p) continue;
      var dur = +el.getAttribute('data-dur') || 2000, delay = +el.getAttribute('data-delay') || 0;
      var t = (((now - delay) % dur) + dur) % dur / dur, stop = parseFloat(el.getAttribute('data-stop')), op = 1;
      var pr = t;
      if (!isNaN(stop)) { pr = Math.min(t / 0.8, 1) * stop; if (t > 0.8) op = 1 - (t - 0.8) / 0.2; }
      else { if (t < 0.06) op = t / 0.06; if (t > 0.94) op = (1 - t) / 0.06; }
      if (el.getAttribute('data-rev')) pr = 1 - pr;
      var len = p.getTotalLength(), pt = p.getPointAtLength(pr * len);
      el.setAttribute('cx', pt.x.toFixed(1)); el.setAttribute('cy', pt.y.toFixed(1)); el.style.display = 'block'; el.style.opacity = op;
    }
    raf = root.requestAnimationFrame(frame);
  }
  function setHealth(h, msg) {
    Object.keys(h).forEach(function (k) { health[k] = h[k]; });
    if (msg) healthMsg = msg;
    healthL.forEach(function (f) { try { f(health); } catch (e) { /* ignore */ } });
    if (cur !== 9 || !scene) return;
    HK.forEach(function (k) {
      var st = health[k[0]], c = q('#hc-' + k[0])[0], l = q('#hl-' + k[0])[0], t = q('#ht-' + k[0])[0]; if (!c) return;
      c.setAttribute('class', 'hcard ' + st[0]); l.setAttribute('class', 'led ' + st[0]);
      t.setAttribute('class', 'svt sm ' + (st[0] === 'ok' ? 'ok' : st[0] === 'bad' ? 'bad' : 'warn')); t.textContent = st[1];
    });
    var m = q('#hmsg')[0]; if (m) { m.textContent = healthMsg; m.setAttribute('class', 'svt b ' + (healthMsg.indexOf('operational') >= 0 ? 'ok' : 'bad')); }
  }
  function init(svgEl) {
    svg = svgEl; scene = svg.querySelector('#scene');
    if (!raf && !reduce) raf = root.requestAnimationFrame(frame);
  }

  root.Anim = {
    init: init, show: show, setBeat: setBeat, setHealth: setHealth, resetHealth: resetHealth,
    pause: function () { paused = true; }, resume: function () { paused = false; },
    onBeat: function (f) { listeners.push(f); }, onHealth: function (f) { healthL.push(f); }, get beat() { return beat; }, get max() { return max; }, get step() { return cur; },
    health: health
  };
})(window);

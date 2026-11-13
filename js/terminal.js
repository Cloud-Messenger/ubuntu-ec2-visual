/* terminal.js – simulated terminal. Nothing here touches a real server. */
(function (root) {
  'use strict';
  var IP = root.PUBLIC_IP || '203.0.113.25';
  var HOST = 'ip-172-31-24-87';
  var out, input, promptEl, explorerEl, busy = false, hist = [], hi = 0;
  var st = { mode: 'local', cwd: '~', keyLocked: false, installed: false, running: false, enabled: false, updated: false, upgraded: false, deployed: false, hasWebsite: false };
  var listeners = [];

  var DESC = {
    'whoami': 'Print the current user name.', 'pwd': 'Print the current working directory.', 'ls': 'List directory contents.',
    'ls -la': 'List all files (including hidden) with permissions, owner and size.', 'uname -a': 'Kernel name, version and architecture.',
    'cat /etc/os-release': 'Show which Linux distribution and version this is.', 'hostname': 'Print the machine name (derived from the private IP).',
    'df -h': 'Disk usage per filesystem, human-readable.', 'free -m': 'RAM and swap usage in megabytes.', 'uptime': 'How long the server has been up, and CPU load averages.',
    'ip addr': 'Show network interfaces and IP addresses.', 'sudo apt update': 'Refresh the package index from the repositories.',
    'sudo apt upgrade -y': 'Install newer versions of installed packages.', 'sudo apt install nginx -y': 'Install the NGINX web server.',
    'nginx -v': 'Show the installed NGINX version.', 'sudo systemctl enable --now nginx': 'Start NGINX now and at every boot.',
    'sudo systemctl status nginx': 'Show whether the NGINX service is running.', 'sudo systemctl restart nginx': 'Stop and start the NGINX service.',
    'sudo cp -r website/* /var/www/html/': 'Copy your site into the NGINX document root.', 'curl http://localhost': 'Fetch the home page from this server itself.',
    'curl -I http://localhost': 'Fetch only the HTTP response headers.', 'sudo nginx -t': 'Test the NGINX configuration for syntax errors.',
    'sudo journalctl -u nginx -n 50': 'Show the last 50 log lines for the nginx service.', 'ss -tulpn': 'List listening TCP/UDP ports and their processes.',
    'chmod 400 key.pem': 'Make the private key readable only by you.',
    'ls /var/www/html': 'List the files NGINX serves.'
  };
  DESC['ssh -i key.pem ubuntu@' + IP] = 'Open an SSH session to the instance.';
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(s) { return esc(s).replace(/\[(g|r|y|b|d|o)\]/g, '<span class="t-$1">').replace(/\[\/\]/g, '</span>'); }
  function line(s, cls) { var d = document.createElement('div'); d.className = 'tl' + (cls ? ' ' + cls : ''); d.innerHTML = fmt(s) || '&nbsp;'; out.appendChild(d); out.scrollTop = out.scrollHeight; }
  async function print(lines, delay) { for (var i = 0; i < lines.length; i++) { line(lines[i]); if (delay) await sleep(delay); } }
  function emit() { listeners.forEach(function (f) { try { f(st); } catch (e) { /* ignore */ } }); }

  function cwdShown() { return st.cwd; }
  function prompt() {
    if (st.mode === 'local') return 'you@laptop:~/Downloads$';
    return 'ubuntu@' + HOST + ':' + cwdShown() + '$';
  }
  function updPrompt() { if (promptEl) promptEl.textContent = prompt(); }

  var BANNER = ['Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-1018-aws x86_64)', '',
    ' * Documentation:  https://help.ubuntu.com', ' * Management:     https://landscape.canonical.com', ' * Support:        https://ubuntu.com/pro', '',
    ' System information as of Fri Nov 13 14:05:11 UTC 2026', '',
    '  System load:  0.08              Processes:             104',
    '  Usage of /:   24.9% of 6.71GB   Users logged in:       0',
    '  Memory usage: 21%               IPv4 address for ens5: 172.31.24.87', '',
    '[d]Last login: Fri Nov 13 13:58:02 2026 from 198.51.100.7[/]'];

  function lsHome(long) {
    var files = ['.bash_logout', '.bashrc', '.cache', '.profile', '.ssh', '.sudo_as_admin_successful'];
    if (!long) return st.hasWebsite ? ['website'] : [''];
    var L = ['total ' + (st.hasWebsite ? 32 : 28),
      'drwxr-x--- 5 ubuntu ubuntu 4096 Nov 13 14:05 [b].[/]', 'drwxr-xr-x 3 root   root   4096 Nov 13 13:52 [b]..[/]',
      '-rw-r--r-- 1 ubuntu ubuntu  220 Mar 31  2024 .bash_logout', '-rw-r--r-- 1 ubuntu ubuntu 3771 Mar 31  2024 .bashrc',
      'drwx------ 2 ubuntu ubuntu 4096 Nov 13 14:05 [b].cache[/]', '-rw-r--r-- 1 ubuntu ubuntu  807 Mar 31  2024 .profile',
      'drwx------ 2 ubuntu ubuntu 4096 Nov 13 13:52 [b].ssh[/]', '-rw-r--r-- 1 ubuntu ubuntu    0 Nov 13 14:05 .sudo_as_admin_successful'];
    if (st.hasWebsite) L.push('drwxr-xr-x 3 ubuntu ubuntu 4096 Nov 13 14:20 [b]website[/]');
    return L;
  }
  function webRoot() { return st.deployed ? ['assets', 'index.html', 'index.nginx-debian.html', 'script.js', 'style.css'] : st.installed ? ['index.nginx-debian.html'] : null; }
  function homeLikeCwd() { return st.cwd === '~'; }

  var NGINX_DEFAULT = ['<!DOCTYPE html>', '<html>', '<head>', '<title>Welcome to nginx!</title>', '<style>', 'html { color-scheme: light dark; }', '...', '</head>', '<body>', '<h1>Welcome to nginx!</h1>',
    '<p>If you see this page, the nginx web server is successfully installed and', 'working. Further configuration is required.</p>', '...'];
  var NGINX_SITE = ['<!DOCTYPE html>', '<html lang="en">', '<head>', '<meta charset="UTF-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">', '<title>CloudFlix – Demo Streaming Landing Page</title>', '...'];

  function needNginx() { return !st.installed ? ['[r]bash: nginx: command not found[/]  (hint: sudo apt install nginx -y)'] : null; }

  var H = {
    whoami: function () { return ['ubuntu']; },
    pwd: function () { return [st.cwd === '~' ? '/home/ubuntu' : st.cwd]; },
    hostname: function () { return [HOST]; },
    date: function () { return ['Fri Nov 13 14:07:42 UTC 2026']; },
    id: function () { return ['uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),24(cdrom),27(sudo),30(dip),105(lxd)']; },
    uptime: function () { return [' 14:07:42 up 15 min,  1 user,  load average: 0.08, 0.03, 0.01']; },
    'uname -a': function () { return ['Linux ' + HOST + ' 6.8.0-1018-aws #19-Ubuntu SMP Wed Oct  9 16:48:30 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux']; },
    'cat /etc/os-release': function () { return ['PRETTY_NAME="Ubuntu 24.04.1 LTS"', 'NAME="Ubuntu"', 'VERSION_ID="24.04"', 'VERSION="24.04.1 LTS (Noble Numbat)"', 'VERSION_CODENAME=noble', 'ID=ubuntu', 'ID_LIKE=debian', 'HOME_URL="https://www.ubuntu.com/"', 'SUPPORT_URL="https://help.ubuntu.com/"']; },
    'df -h': function () {
      return ['Filesystem       Size  Used Avail Use% Mounted on', 'tmpfs            92M  1.0M   91M   2% /run', '/dev/root        6.8G  ' + (st.installed ? '2.0G' : '1.8G') + '  4.8G  ' + (st.installed ? '30' : '27') + '% /', 'tmpfs           458M     0  458M   0% /dev/shm',
        'tmpfs           5.0M     0  5.0M   0% /run/lock', '/dev/nvme0n1p16  881M   76M  744M  10% /boot', '/dev/nvme0n1p15  105M  6.1M   99M   6% /boot/efi', 'tmpfs            92M   12K   92M   1% /run/user/1000'];
    },
    'free -m': function () {
      return ['               total        used        free      shared  buff/cache   available', 'Mem:             914         ' + (st.running ? '212' : '176') + '         ' + (st.running ? '420' : '456') + '           0         ' + (st.running ? '281' : '281') + '         ' + (st.running ? '702' : '738'), 'Swap:              0           0           0'];
    },
    'ip addr': function () {
      return ['1: [b]lo[/]: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000', '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00', '    inet 127.0.0.1/8 scope host lo',
        '2: [b]ens5[/]: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9001 qdisc mq state UP group default qlen 1000', '    link/ether 06:5a:3c:8e:1f:2b brd ff:ff:ff:ff:ff:ff', '    inet [g]172.31.24.87/20[/] metric 100 brd 172.31.31.255 scope global dynamic ens5',
        '[d]# 172.31.24.87 is the PRIVATE IP. The public IP is mapped by AWS and not shown here.[/]'];
    },
    'nginx -v': function () { return needNginx() || ['nginx version: nginx/1.24.0 (Ubuntu)']; },
    'ss -tulpn': function () {
      var L = ['Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process', 'udp   UNCONN 0      0      127.0.0.54:53       0.0.0.0:*     users:(("systemd-resolve",pid=402,fd=16))', 'tcp   LISTEN 0      4096   127.0.0.54:53       0.0.0.0:*', 'tcp   LISTEN 0      128    0.0.0.0:22         0.0.0.0:*     users:(("sshd",pid=689,fd=3))'];
      if (st.running) { L.push('tcp   LISTEN 0      511    0.0.0.0:[g]80[/]         0.0.0.0:*     users:(("nginx",pid=1523,fd=5),("nginx",pid=1522,fd=5))'); L.push('tcp   LISTEN 0      511    [::]:[g]80[/]            [::]:*'); }
      L.push('tcp   LISTEN 0      128    [::]:22            [::]:*'); return L;
    },
    'ls /var/www/html': function () { var w = webRoot(); return w ? [w.join('  ')] : ['ls: cannot access \'/var/www/html\': No such file or directory']; },
    'sudo nginx -t': function () { return needNginx() || ['nginx: the configuration file /etc/nginx/nginx.conf syntax is [g]ok[/]', 'nginx: configuration file /etc/nginx/nginx.conf test is [g]successful[/]']; },
    'sudo journalctl -u nginx -n 50': function () {
      if (!st.installed) return ['-- No entries --'];
      return ['Nov 13 14:06:01 ' + HOST + ' systemd[1]: Starting nginx.service - A high performance web server and a reverse proxy server...', 'Nov 13 14:06:01 ' + HOST + ' systemd[1]: Started nginx.service - A high performance web server and a reverse proxy server.']
        .concat(st.running ? [] : ['Nov 13 14:09:10 ' + HOST + ' systemd[1]: Stopping nginx.service...', 'Nov 13 14:09:10 ' + HOST + ' systemd[1]: Stopped nginx.service.']);
    },
    'curl -I http://localhost': function () {
      if (!st.running) return ['curl: (7) Failed to connect to localhost port 80 after 0 ms: Couldn\'t connect to server'];
      return ['HTTP/1.1 [g]200 OK[/]', 'Server: nginx/1.24.0 (Ubuntu)', 'Date: Fri, 13 Nov 2026 14:10:02 GMT', 'Content-Type: text/html', 'Content-Length: ' + (st.deployed ? '4521' : '615'), 'Last-Modified: Fri, 13 Nov 2026 14:06:01 GMT', 'Connection: keep-alive', 'ETag: "6740a1b9-267"', 'Accept-Ranges: bytes'];
    },
    'curl http://localhost': function () {
      if (!st.running) return ['curl: (7) Failed to connect to localhost port 80 after 0 ms: Couldn\'t connect to server'];
      return st.deployed ? NGINX_SITE : NGINX_DEFAULT;
    },
    'sudo systemctl status nginx': function () {
      if (!st.installed) return ['Unit nginx.service could not be found.'];
      if (!st.running) return ['[r]○[/] nginx.service - A high performance web server and a reverse proxy server', '     Loaded: loaded (/usr/lib/systemd/system/nginx.service; ' + (st.enabled ? 'enabled' : 'disabled') + '; preset: enabled)', '     Active: [r]inactive (dead)[/] since Fri 2026-11-13 14:09:10 UTC; 12s ago'];
      return ['[g]●[/] nginx.service - A high performance web server and a reverse proxy server', '     Loaded: loaded (/usr/lib/systemd/system/nginx.service; ' + (st.enabled ? 'enabled' : 'disabled') + '; preset: enabled)', '     Active: [g]active (running)[/] since Fri 2026-11-13 14:06:01 UTC; 4min ago', '       Docs: man:nginx(8)', '   Main PID: 1522 (nginx)', '      Tasks: 3 (limit: 1075)', '     Memory: 2.4M (peak: 2.9M)', '     CGroup: /system.slice/nginx.service', '             ├─1522 "nginx: master process /usr/sbin/nginx -g daemon on; master_process on;"', '             └─1523 "nginx: worker process"'];
    }
  };
  var ALIAS = { 'ls -l': 'ls -la', 'ls -a': 'ls -la', 'sudo apt-get update': 'sudo apt update', 'nginx -V': 'nginx -v', 'sudo systemctl start nginx': 'sudo systemctl enable --now nginx', 'ss -tlnp': 'ss -tulpn', 'sudo ss -tulpn': 'ss -tulpn', 'curl localhost': 'curl http://localhost', 'curl -I localhost': 'curl -I http://localhost', 'sudo apt install nginx': 'sudo apt install nginx -y', 'sudo apt upgrade': 'sudo apt upgrade -y', 'sudo cp -r website/* /var/www/html': 'sudo cp -r website/* /var/www/html/' };

  async function aptUpdate() {
    await print(['Hit:1 http://ap-south-1.ec2.archive.ubuntu.com/ubuntu noble InRelease', 'Get:2 http://ap-south-1.ec2.archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]', 'Get:3 http://ap-south-1.ec2.archive.ubuntu.com/ubuntu noble-backports InRelease [126 kB]', 'Get:4 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]', 'Get:5 http://ap-south-1.ec2.archive.ubuntu.com/ubuntu noble/universe amd64 Packages [15.0 MB]', 'Fetched 15.8 MB in 2s (7,412 kB/s)', 'Reading package lists... [g]Done[/]', 'Building dependency tree... [g]Done[/]', '12 packages can be upgraded. Run \'apt list --upgradable\' to see them.'], 110);
    st.updated = true;
  }
  async function aptUpgrade() {
    if (!st.updated) await print(['[y]Tip: run "sudo apt update" first so APT knows what is new.[/]'], 0);
    await print(['Reading package lists... [g]Done[/]', 'Calculating upgrade... [g]Done[/]', 'The following packages will be upgraded:', '  libc6 libssl3t64 openssh-server systemd tzdata ...', '12 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.', 'Get:1 http://ap-south-1.ec2.archive.ubuntu.com/ubuntu noble-updates/main amd64 libc6 amd64 [2,910 kB]', 'Unpacking libc6:amd64 ...', 'Setting up libc6:amd64 ...', 'Processing triggers for man-db ...', '[g]Done.[/] Some services may need a restart (needrestart).'], 130);
    st.upgraded = true;
  }
  async function aptNginx() {
    if (st.installed) { await print(['nginx is already the newest version (1.24.0-2ubuntu7).', '0 upgraded, 0 newly installed, 0 to remove.'], 0); return; }
    await print(['Reading package lists... [g]Done[/]', 'The following NEW packages will be installed:', '  nginx nginx-common', 'Need to get 564 kB of archives. After this operation, 1,596 kB of additional disk space will be used.',
      'Get:1 http://ap-south-1.ec2.archive.ubuntu.com/ubuntu noble-updates/main amd64 nginx amd64 1.24.0-2ubuntu7 [48.4 kB]'], 140);
    for (var p = 0; p <= 100; p += 20) { line('Progress: [' + ('#'.repeat(p / 5) + '.'.repeat(20 - p / 5)) + '] ' + p + '%'); await sleep(120); }
    await print(['Selecting previously unselected package nginx.', 'Unpacking nginx (1.24.0-2ubuntu7) ...', 'Setting up nginx (1.24.0-2ubuntu7) ...', 'Created symlink /etc/systemd/system/multi-user.target.wants/nginx.service → /usr/lib/systemd/system/nginx.service.', '[g]nginx is installed and started automatically on Ubuntu.[/]'], 140);
    st.installed = true; st.running = true; st.enabled = true; emit();
  }

  async function runLocal(cmd) {
    if (cmd === 'chmod 400 key.pem') { st.keyLocked = true; return; }
    if (cmd === 'ls' || cmd === 'ls -l key.pem' || cmd === 'ls -la') { return cmd === 'ls' ? ['key.pem'] : [(st.keyLocked ? '-r--------' : '-rw-r--r--') + ' 1 you you 1675 Nov 13 13:50 key.pem']; }
    if (cmd === 'pwd') return ['/home/you/Downloads'];
    if (cmd === 'whoami') return ['you'];
    var m = /^ssh\s+-i\s+(\S+)\s+(\S+)@(\S+)$/.exec(cmd);
    if (cmd.indexOf('ssh') === 0) {
      if (!m) return ['usage: ssh -i key.pem ubuntu@<PUBLIC-IP>'];
      if (m[1] !== 'key.pem') return ['Warning: Identity file ' + m[1] + ' not accessible: No such file or directory.', '[r]ubuntu@' + m[3] + ': Permission denied (publickey).[/]'];
      if (!st.keyLocked) return ['@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@', '@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @', '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@', 'Permissions 0644 for \'key.pem\' are too open.', 'This private key will be ignored.', '[r]ubuntu@' + m[3] + ': Permission denied (publickey).[/]', '[y]Fix: chmod 400 key.pem[/]'];
      if (m[2] !== 'ubuntu') return ['[r]' + m[2] + '@' + m[3] + ': Permission denied (publickey).[/]', '[y]On Ubuntu AMIs the default user is "ubuntu".[/]'];
      if (m[3] !== IP) return ['(simulation) This lesson only simulates the instance at ' + IP + '. Use that address.'];
      await print(['Warning: Permanently added \'' + IP + '\' (ED25519) to the list of known hosts.', '[d]debug1: Authentications that can continue: publickey[/]', '[d]debug1: Offering public key: key.pem[/]', '[g]Authenticated to ' + IP + ' using "publickey".[/]', ''], 200);
      await print(BANNER, 45); st.mode = 'remote'; st.cwd = '~'; updPrompt(); emit(); return null;
    }
    if (cmd === 'help') return ['Local laptop commands: chmod 400 key.pem · ls -l key.pem · ssh -i key.pem ubuntu@' + IP];
    return ['(simulation) You are on your laptop. Connect first:', '  chmod 400 key.pem', '  ssh -i key.pem ubuntu@' + IP];
  }

  async function runRemote(raw) {
    var cmd = raw.replace(/\s+/g, ' ').trim(); cmd = ALIAS[cmd] || cmd;
    if (cmd === 'exit' || cmd === 'logout') { st.mode = 'local'; updPrompt(); emit(); return ['logout', 'Connection to ' + IP + ' closed.']; }
    if (cmd === 'help') return ['Try: whoami · pwd · ls -la · uname -a · cat /etc/os-release · hostname · df -h · free -m · uptime · ip addr', 'APT:   sudo apt update · sudo apt upgrade -y · sudo apt install nginx -y', 'NGINX: sudo systemctl enable --now nginx · sudo systemctl status nginx · sudo nginx -t · curl http://localhost', 'Deploy: sudo cp -r website/* /var/www/html/   ·   Also: cd, ls /var/www/html, ss -tulpn, clear, exit'];
    if (/^cd(\s|$)/.test(cmd)) {
      var t = cmd.slice(2).trim(); var map = { '': '~', '~': '~', '/home/ubuntu': '~', '..': st.cwd === '~' ? '/home' : '/', '/': '/', '/var/www/html': '/var/www/html', '/etc/nginx': '/etc/nginx', '/home': '/home', website: st.hasWebsite && st.cwd === '~' ? '~/website' : null };
      if (t in map && map[t]) { st.cwd = map[t]; updPrompt(); return []; }
      return ['bash: cd: ' + t + ': No such file or directory'];
    }
    if (cmd === 'ls' || cmd === 'ls -la') {
      if (st.cwd === '~') return lsHome(cmd === 'ls -la');
      if (st.cwd === '/') return ['bin  boot  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var'];
      if (st.cwd === '/var/www/html') return H['ls /var/www/html']();
      if (st.cwd === '~/website') return ['assets  index.html  script.js  style.css'];
      if (st.cwd === '/etc/nginx') return st.installed ? ['conf.d  mime.types  nginx.conf  sites-available  sites-enabled  snippets'] : ['ls: cannot access: No such file or directory'];
      return ['ubuntu'];
    }
    if (cmd === 'ls website' || cmd === 'ls ~/website') return st.hasWebsite ? ['assets  index.html  script.js  style.css'] : ['ls: cannot access \'website\': No such file or directory'];
    if (cmd === 'sudo apt update') { await aptUpdate(); return null; }
    if (cmd === 'sudo apt upgrade -y') { await aptUpgrade(); return null; }
    if (cmd === 'sudo apt install nginx -y') { await aptNginx(); return null; }
    if (cmd === 'sudo systemctl enable --now nginx') { if (!st.installed) return ['Failed to enable unit: Unit file nginx.service does not exist.']; st.running = true; st.enabled = true; emit(); return ['Synchronizing state of nginx.service with SysV service script...', 'Executing: /usr/lib/systemd/systemd-sysv-install enable nginx', '[g]nginx started and enabled at boot.[/]']; }
    if (cmd === 'sudo systemctl restart nginx') { if (!st.installed) return ['Failed to restart nginx.service: Unit nginx.service not found.']; st.running = true; emit(); return []; }
    if (cmd === 'sudo systemctl stop nginx') { if (!st.installed) return ['Failed to stop nginx.service: Unit nginx.service not loaded.']; st.running = false; emit(); return []; }
    if (cmd === 'sudo cp -r website/* /var/www/html/') {
      if (!st.hasWebsite || st.cwd !== '~') return ['cp: cannot stat \'website/*\': No such file or directory', '[y]Run this from the folder that contains website/ (your home, ~), after uploading the files with git clone or scp.[/]'];
      if (!st.installed) return ['cp: cannot create regular file \'/var/www/html/index.html\': No such file or directory', '[y]Install NGINX first.[/]'];
      st.deployed = true; emit(); return ['[g]Copied index.html, style.css, script.js and assets/ to /var/www/html/[/]'];
    }
    if (cmd === 'clear') { out.innerHTML = ''; return []; }
    if (H[cmd]) return H[cmd]();
    if (/^sudo /.test(cmd) || /^(apt|systemctl)/.test(cmd)) return ['[y](simulation) That command is not part of this lesson. Type help to see supported commands.[/]'];
    return ['bash: ' + cmd.split(' ')[0] + ': command not found', '[d]Type help to see the commands this simulator supports.[/]'];
  }

  async function run(raw) {
    if (busy) return; var cmd = raw.trim(); if (!cmd) return;
    busy = true; input.disabled = true;
    line(prompt() + ' ' + cmd, 'tl-cmd'); hist.push(cmd); hi = hist.length;
    try {
      var res;
      if (cmd === 'clear') { out.innerHTML = ''; res = []; }
      else res = st.mode === 'local' ? await runLocal(cmd) : await runRemote(cmd);
      if (res && res.length) await print(res, 25);
    } catch (e) { line('[r]simulator error: ' + e.message + '[/]'); }
    busy = false; input.disabled = false; updPrompt(); renderExplorer(); input.focus({ preventScroll: true });
  }

  function typeAndRun(cmd) {
    if (busy) return; input.value = ''; var i = 0;
    (function tick() { if (i < cmd.length) { input.value += cmd[i++]; setTimeout(tick, 12); } else { var v = input.value; input.value = ''; run(v); } })();
  }

  var explorerList = [];
  function renderExplorer() {
    if (!explorerEl) return; explorerEl.innerHTML = '';
    explorerList.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cmd-chip';
      b.innerHTML = '<code>' + esc(c) + '</code><small>' + esc(DESC[c] || '') + '</small>';
      b.addEventListener('click', function () { typeAndRun(c); }); explorerEl.appendChild(b);
    });
  }

  function setScenario(step) {
    st.keyLocked = step >= 5 ? st.keyLocked : false;
    if (step <= 5) { st.mode = 'local'; st.cwd = '~'; st.installed = st.running = st.enabled = st.updated = st.upgraded = st.deployed = st.hasWebsite = false; st.keyLocked = false; }
    else { st.mode = 'remote'; st.keyLocked = true; if (step < 7) { st.installed = st.running = st.enabled = st.updated = st.upgraded = st.deployed = st.hasWebsite = false; } }
    if (step === 7) { st.installed = st.running = st.enabled = st.deployed = st.hasWebsite = false; }
    if (step === 8) { st.installed = st.running = st.enabled = st.updated = st.upgraded = true; st.deployed = false; st.hasWebsite = true; st.cwd = '~'; }
    if (step >= 9) { st.installed = st.running = st.enabled = st.deployed = st.hasWebsite = true; }
    var lists = {
      5: ['chmod 400 key.pem', 'ssh -i key.pem ubuntu@' + IP, 'ls -la'],
      6: ['whoami', 'pwd', 'ls', 'ls -la', 'uname -a', 'cat /etc/os-release', 'hostname', 'df -h', 'free -m', 'uptime', 'ip addr'],
      7: ['sudo apt update', 'sudo apt upgrade -y', 'sudo apt install nginx -y', 'nginx -v', 'sudo systemctl status nginx', 'df -h'],
      8: ['sudo systemctl enable --now nginx', 'sudo systemctl status nginx', 'sudo cp -r website/* /var/www/html/', 'ls /var/www/html', 'curl http://localhost', 'curl -I http://localhost'],
      9: ['sudo systemctl status nginx', 'sudo nginx -t', 'sudo journalctl -u nginx -n 50', 'curl -I http://localhost', 'df -h', 'free -m', 'ss -tulpn', 'sudo systemctl restart nginx']
    };
    explorerList = lists[step] || lists[5];
    if (out) {
      out.innerHTML = ''; line('[d]SIMULATED terminal: no real server is contacted. Type "help" for supported commands.[/]');
      if (st.mode === 'remote') line('[d]You are already connected as ubuntu (step ' + step + ' starts from a connected session).[/]');
      else line('[d]Start here: chmod 400 key.pem, then ssh -i key.pem ubuntu@' + IP + '[/]');
    }
    updPrompt(); renderExplorer(); emit();
  }

  function init(opts) {
    out = opts.out; input = opts.input; promptEl = opts.prompt; explorerEl = opts.explorer;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var v = input.value; input.value = ''; run(v); }
      else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; input.value = hist[hi]; } e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (hi < hist.length - 1) { hi++; input.value = hist[hi]; } else { hi = hist.length; input.value = ''; } e.preventDefault(); }
      else if (e.key === 'l' && e.ctrlKey) { out.innerHTML = ''; e.preventDefault(); }
    });
    out.parentNode.addEventListener('click', function (e) { if (!window.getSelection().toString() && e.target.tagName !== 'BUTTON') input.focus({ preventScroll: true }); });
    updPrompt();
  }
  root.Terminal = { init: init, setScenario: setScenario, state: st, onChange: function (f) { listeners.push(f); }, typeAndRun: typeAndRun, run: run, _esc: esc, _fmt: fmt };
})(window);

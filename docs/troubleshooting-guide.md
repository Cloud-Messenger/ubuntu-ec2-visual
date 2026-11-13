# Troubleshooting guide

**Method:** work outside-in (AWS) and inside-out (Ubuntu).

1. Is the **instance running** with **2/2 checks**?
2. Is the **public IP** the one you are using? Does the subnet route to an Internet Gateway?
3. Does the **Security Group** allow the port from your source?
4. On the server: is the **service active**, is the **config valid**, are **files present with correct permissions**, is there **free disk**?

Handy commands:

```bash
sudo systemctl status nginx
sudo systemctl restart nginx
sudo nginx -t
sudo journalctl -u nginx -n 50
curl -I http://localhost
df -h
free -m
ss -tulpn
```

Rule of thumb: **`curl localhost` OK but the browser fails ⇒ the problem is between the internet and the instance** (Security Group, NACL, IP, route). **`curl localhost` fails ⇒ the problem is on the server.**

---

### 1. SSH connection timed out
- **Cause:** no port-22 rule for your current IP, no public IP, or no route to an Internet Gateway.
- **Diagnose:** `ssh -v -i key.pem ubuntu@<IP>` → `Connection timed out`.
- **Fix:** add *SSH 22 from My IP*; verify public IPv4 and the `0.0.0.0/0 → igw-…` route.
- **Verify:** `ssh -i key.pem ubuntu@<IP>` shows the Ubuntu banner.

### 2. Permission denied (publickey)
- **Cause:** wrong user (`ec2-user`, `root`) or the wrong key.
- **Diagnose:** `ssh -i key.pem ec2-user@<IP>` → `Permission denied (publickey)`.
- **Fix:** use `ubuntu@` and the `.pem` of the key pair chosen at launch. Also `chmod 400 key.pem`.
- **Verify:** `whoami` → `ubuntu`.

### 3. Port 22 blocked
- **Cause:** the SSH rule is a `/32` of an old IP; you changed network.
- **Diagnose:** `nc -vz <IP> 22` times out.
- **Fix:** edit the rule, Source = **My IP**.
- **Verify:** `nc -vz <IP> 22` → `succeeded`.

### 4. HTTP website not loading
- **Diagnose:** on the server `curl -I http://localhost` → `200 OK` ⇒ NGINX is fine; block is outside.
- **Fix:** add HTTP 80 from `0.0.0.0/0`; check IP and NACL.
- **Verify:** `curl -I http://<IP>` from your laptop.

### 5. Port 80 blocked
- **Diagnose:** `curl -m 5 -I http://<IP>` → `Connection timed out`.
- **Fix:** Security Group inbound HTTP 80; NACL must allow 80 and ephemeral ports (1024-65535).
- **Verify:** `HTTP/1.1 200 OK`.

### 6. Incorrect public IP
- **Cause:** auto-assigned public IPv4 changes on stop/start.
- **Fix:** use the current IP or allocate an **Elastic IP** and associate it.

### 7. EC2 instance stopped
- **Diagnose:** `aws ec2 describe-instances … --query "…State.Name"` → `stopped`.
- **Fix:** start the instance. **Verify:** `describe-instance-status` → `ok`.

### 8. NGINX service stopped
- **Diagnose:** `sudo systemctl status nginx` → `inactive (dead)`; `ss -tulpn` shows no `:80`.
- **Fix:** `sudo systemctl enable --now nginx`. **Verify:** status `active (running)`.

### 9. Default NGINX page showing
- **Cause:** your files are not in `/var/www/html` (or are in a sub-folder).
- **Diagnose:** `ls /var/www/html` → only `index.nginx-debian.html`.
- **Fix:** `sudo cp -r website/* /var/www/html/`. **Verify:** `curl -s http://localhost | grep -i "<title>"`.

### 10. Incorrect website file permissions (403)
- **Diagnose:** `sudo tail /var/log/nginx/error.log` → `(13: Permission denied)`.
- **Fix:**
  ```bash
  sudo find /var/www/html -type d -exec chmod 755 {} \;
  sudo find /var/www/html -type f -exec chmod 644 {} \;
  ```
- **Verify:** `curl -I http://localhost` → `200 OK`.

### 11. Ubuntu disk space exhausted
- **Diagnose:** `df -h /` shows `100%`.
- **Fix:** `sudo apt clean`, `sudo journalctl --vacuum-size=100M`, find big files with `sudo du -xh / --max-depth=2 | sort -h | tail`; long term grow the EBS volume and run `growpart` + `resize2fs`.
- **Verify:** `df -h /` shows free space.

### 12. NGINX configuration error
- **Diagnose:** `sudo nginx -t` → `[emerg] … in /etc/nginx/…:LINE`.
- **Fix:** correct the line (often a missing `;` or `}`), `sudo nginx -t && sudo systemctl restart nginx`.
- **Verify:** `systemctl status nginx` → `active (running)`.

---

## Final production health check

- ✔ EC2 instance running
- ✔ SSH connection working
- ✔ Ubuntu operational
- ✔ NGINX active
- ✔ HTTP port 80 accessible
- ✔ Website successfully loading

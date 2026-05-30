import json
import os
import sys

import pexpect


def run_command(child, command, prompt):
    child.sendline(command)
    output = ""
    last_length = 0
    stalled_timeouts = 0

    for _ in range(500):
        index = child.expect([r"--More--", r"More:", prompt, pexpect.TIMEOUT, pexpect.EOF], timeout=2)
        output += child.before or ""

        if index in (0, 1):
            stalled_timeouts = 0
            child.send(" ")
            continue

        if index == 2:
            return output

        if output:
            if len(output) > last_length:
                last_length = len(output)
                stalled_timeouts = 0
                child.send(" ")
                continue

            stalled_timeouts += 1
            if stalled_timeouts < 3:
                child.send(" ")
                continue

            return output

        raise RuntimeError(f"command timed out: {command}")

    return output


def main():
    host = os.environ["OLT_HOST"]
    port = os.environ.get("OLT_PORT", "22")
    username = os.environ["OLT_USERNAME"]
    password = os.environ["OLT_PASSWORD"]
    commands = json.loads(os.environ["OLT_COMMANDS"])
    prompt = os.environ.get("OLT_PROMPT", r"[#>]\s*$")

    ssh_command = (
        "ssh -tt "
        "-o StrictHostKeyChecking=no "
        "-o UserKnownHostsFile=/dev/null "
        "-o PreferredAuthentications=password "
        "-o PubkeyAuthentication=no "
        "-o ConnectTimeout=8 "
        "-o HostKeyAlgorithms=+ssh-rsa "
        "-o PubkeyAcceptedAlgorithms=+ssh-rsa "
        "-o KexAlgorithms=diffie-hellman-group14-sha1,diffie-hellman-group1-sha1 "
        "-o MACs=+hmac-sha1,hmac-md5 "
        "-o Ciphers=aes128-cbc,3des-cbc "
        f"-p {port} {username}@{host}"
    )
    child = pexpect.spawn(ssh_command, encoding="utf-8", timeout=12)
    child.delaybeforesend = 0.02

    try:
        for _ in range(4):
            login_index = child.expect([
                r"yes/no",
                r"[Pp]assword:",
                prompt,
                pexpect.TIMEOUT,
                pexpect.EOF,
            ], timeout=12)

            if login_index == 0:
                child.sendline("yes")
                continue

            if login_index == 1:
                child.sendline(password)
                continue

            if login_index == 2:
                break

            raise RuntimeError(
                "ssh login did not reach OLT prompt: before="
                + repr((child.before or "")[-300:])
                + " after="
                + repr(child.after)
            )
        else:
            raise RuntimeError(
                "ssh login did not reach OLT prompt: before="
                + repr((child.before or "")[-300:])
                + " after="
                + repr(child.after)
            )

        outputs = {}
        for setup in ["terminal page-break disable"]:
            try:
                run_command(child, setup, prompt)
            except Exception:
                pass

        for command in commands:
            outputs[command] = run_command(child, command, prompt)

        print(json.dumps({"ok": True, "outputs": outputs}))
    finally:
        try:
            child.sendline("exit")
            child.close(force=True)
        except Exception:
            pass


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        sys.exit(1)

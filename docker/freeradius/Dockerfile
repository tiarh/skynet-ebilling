FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates freeradius freeradius-mysql freeradius-utils \
    && rm -rf /var/lib/apt/lists/*

COPY docker/freeradius/sql /etc/freeradius/3.0/mods-available/sql
COPY docker/freeradius/entrypoint.sh /usr/local/bin/skynet-radius-entrypoint

RUN ln -sf ../mods-available/sql /etc/freeradius/3.0/mods-enabled/sql \
    && sed -i 's/^[[:space:]]*#*[[:space:]]*-sql/sql/g' /etc/freeradius/3.0/sites-enabled/default \
    && sed -i 's/^[[:space:]]*#*[[:space:]]*-sql/sql/g' /etc/freeradius/3.0/sites-enabled/inner-tunnel \
    && chown -R root:freerad /etc/freeradius/3.0 \
    && find /etc/freeradius/3.0 -type d -exec chmod 750 {} \; \
    && find /etc/freeradius/3.0 -type f -exec chmod 640 {} \; \
    && chmod +x /usr/local/bin/skynet-radius-entrypoint

EXPOSE 1812/udp 1813/udp

ENTRYPOINT ["skynet-radius-entrypoint"]
CMD ["freeradius", "-f", "-l", "stdout"]

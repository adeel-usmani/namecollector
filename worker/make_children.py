#!/usr/bin/env python3

import pandas as pd

df = pd.read_csv("mastoorat_master_gta.csv")

cities = ["Brampton", "Toronto", "Mississauga", "Etobicoke"]

for city in cities:
    mask = df["address"].str.contains(city, case=False, na=False)
    city_df = df[mask]
    if not city_df.empty:
        city_df.to_csv(f"mastoorat_{city.lower()}.csv", index=False)

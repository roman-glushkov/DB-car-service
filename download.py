from datasets import load_dataset
import os

out = "csv_out"
os.makedirs(out, exist_ok=True)

# список всех 8 подмножеств датасета
subsets = [
    "customers",
    "vehicles",
    "invoices",
    "service_history",
    "retail_locations",
    "service_business_types",
    "service_domains",
    "invoice_line_categories",
]

for name in subsets:
    print(f"=== {name} ===")
    try:
        ds = load_dataset(
            "Growing-Moss-Data/automotive-service-intelligence-sample",
            name,
            split="train",
        )
        path = os.path.join(out, f"{name}.csv")
        ds.to_csv(path)
        print(f"OK -> {path} ({len(ds)} строк)")
    except Exception as e:
        print(f"FAIL {name}: {e}")
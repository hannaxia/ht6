"""Shared evaluation + feature-importance reporting for both models."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def evaluate(y_true, y_pred, label: str, unit: str = "") -> dict[str, float]:
    """Prints and returns MAE / RMSE / R2 in the format the spec asks for."""
    mae = mean_absolute_error(y_true, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = r2_score(y_true, y_pred)

    print(f"\n{label}")
    print("-" * len(label))
    print(f"MAE:\n{unit}{mae:,.4f}")
    print(f"RMSE:\n{unit}{rmse:,.4f}")
    print(f"R2:\n{r2:.4f}")

    return {"mae": mae, "rmse": rmse, "r2": r2}


def feature_importance_report(
    model,
    preprocessor,
    output_path,
    top_n: int = 10,
    label: str = "Model",
) -> pd.DataFrame:
    """
    Reads XGBoost's gain-based feature_importances_ against the
    ColumnTransformer's expanded output names (e.g. "cat__city_Toronto"),
    strips the "num__"/"cat__" prefix, prints the top N, saves the full
    ranking to CSV.
    """
    raw_names = preprocessor.get_feature_names_out()
    names = [n.split("__", 1)[1] if "__" in n else n for n in raw_names]

    importances = model.feature_importances_
    report = (
        pd.DataFrame({"feature": names, "importance": importances})
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )
    report.to_csv(output_path, index=False)

    print(f"\n{label} — top {top_n} factors influencing predictions:")
    for i, row in report.head(top_n).iterrows():
        print(f"{i + 1}. {row['feature']} ({row['importance']:.4f})")

    return report

package com.green.Predict.common;

public class Selection {
  private final int count;

  private Selection(int count) { this.count = count; }

  public static Selection of(String a, String b) {
    int c = (a != null && !a.isBlank() ? 1 : 0) + (b != null && !b.isBlank() ? 1 : 0);
    return new Selection(c);
  }

  public int getCount() { return count; }
}
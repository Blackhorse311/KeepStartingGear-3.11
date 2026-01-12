// ============================================================================
// Keep Starting Gear - Reflection Cache (SPT 3.11.4)
// ============================================================================

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Reflection;

namespace Blackhorse311.KeepStartingGear.Services;

/// <summary>
/// Thread-safe cache for reflection lookups.
/// </summary>
public static class ReflectionCache
{
    private static readonly ConcurrentDictionary<(Type, string), PropertyInfo> _propertyCache = new();
    private static readonly ConcurrentDictionary<(Type, string), FieldInfo> _fieldCache = new();
    private static readonly ConcurrentDictionary<(Type, string, int), PropertyInfo> _propertyWithFlagsCache = new();
    private static readonly ConcurrentDictionary<(Type, string, int), FieldInfo> _fieldWithFlagsCache = new();

    public static PropertyInfo GetProperty(Type type, string propertyName)
    {
        if (type == null || string.IsNullOrEmpty(propertyName)) return null;
        var key = (type, propertyName);
        return _propertyCache.GetOrAdd(key, k => k.Item1.GetProperty(k.Item2));
    }

    public static PropertyInfo GetProperty(Type type, string propertyName, BindingFlags bindingFlags)
    {
        if (type == null || string.IsNullOrEmpty(propertyName)) return null;
        var key = (type, propertyName, (int)bindingFlags);
        return _propertyWithFlagsCache.GetOrAdd(key, k => k.Item1.GetProperty(k.Item2, (BindingFlags)k.Item3));
    }

    public static FieldInfo GetField(Type type, string fieldName)
    {
        if (type == null || string.IsNullOrEmpty(fieldName)) return null;
        var key = (type, fieldName);
        return _fieldCache.GetOrAdd(key, k => k.Item1.GetField(k.Item2));
    }

    public static FieldInfo GetField(Type type, string fieldName, BindingFlags bindingFlags)
    {
        if (type == null || string.IsNullOrEmpty(fieldName)) return null;
        var key = (type, fieldName, (int)bindingFlags);
        return _fieldWithFlagsCache.GetOrAdd(key, k => k.Item1.GetField(k.Item2, (BindingFlags)k.Item3));
    }

    public static object GetMemberValue(object obj, string memberName)
    {
        if (obj == null) return null;
        var type = obj.GetType();

        var prop = GetProperty(type, memberName);
        if (prop != null)
        {
            try { return prop.GetValue(obj); }
            catch { /* Ignore */ }
        }

        var field = GetField(type, memberName);
        if (field != null)
        {
            try { return field.GetValue(obj); }
            catch { /* Ignore */ }
        }

        return null;
    }

    public static void ClearCache()
    {
        _propertyCache.Clear();
        _fieldCache.Clear();
        _propertyWithFlagsCache.Clear();
        _fieldWithFlagsCache.Clear();
    }
}

// ============================================================================
// Keep Starting Gear - Location Converter (SPT 3.11.4)
// ============================================================================

using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Blackhorse311.KeepStartingGear.Models;

namespace Blackhorse311.KeepStartingGear.Converters;

/// <summary>
/// JSON converter for polymorphic location data (grid vs cartridge index).
/// </summary>
public class LocationConverter : JsonConverter<LocationConverter.LocationResult>
{
    public class LocationResult
    {
        public ItemLocation GridLocation { get; set; }
        public int? CartridgeIndex { get; set; }
        public bool IsGrid => GridLocation != null;
        public bool IsCartridge => CartridgeIndex.HasValue;
    }

    public override LocationResult ReadJson(JsonReader reader, Type objectType, LocationResult existingValue, bool hasExistingValue, JsonSerializer serializer)
    {
        if (reader.TokenType == JsonToken.Null)
            return null;

        if (reader.TokenType == JsonToken.Integer)
        {
            return new LocationResult { CartridgeIndex = Convert.ToInt32(reader.Value) };
        }

        if (reader.TokenType == JsonToken.StartObject)
        {
            var jObject = JObject.Load(reader);
            return new LocationResult
            {
                GridLocation = new ItemLocation
                {
                    X = jObject["x"]?.Value<int>() ?? 0,
                    Y = jObject["y"]?.Value<int>() ?? 0,
                    R = jObject["r"]?.Value<int>() ?? 0,
                    IsSearched = jObject["isSearched"]?.Value<bool>() ?? true
                }
            };
        }

        return null;
    }

    public override void WriteJson(JsonWriter writer, LocationResult value, JsonSerializer serializer)
    {
        if (value == null)
        {
            writer.WriteNull();
            return;
        }

        if (value.IsCartridge)
        {
            writer.WriteValue(value.CartridgeIndex.Value);
        }
        else if (value.IsGrid)
        {
            writer.WriteStartObject();
            writer.WritePropertyName("x");
            writer.WriteValue(value.GridLocation.X);
            writer.WritePropertyName("y");
            writer.WriteValue(value.GridLocation.Y);
            writer.WritePropertyName("r");
            writer.WriteValue(value.GridLocation.R);
            writer.WritePropertyName("isSearched");
            writer.WriteValue(value.GridLocation.IsSearched);
            writer.WriteEndObject();
        }
        else
        {
            writer.WriteNull();
        }
    }
}

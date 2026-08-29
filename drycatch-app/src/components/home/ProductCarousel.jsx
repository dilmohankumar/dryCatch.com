import { FlatList, StyleSheet } from "react-native";
import ProductCard from "../product/ProductCard";
import { useResponsive } from "../../hooks/useResponsive";

export default function ProductCarousel({ products }) {
  const { isTablet } = useResponsive();
  // A fixed 168px card looks stranded on a 10-13" tablet — scale it up a
  // little so carousels feel proportional instead of phone-sized-and-tiny.
  const cardWidth = isTablet ? 220 : 168;

  return (
    <FlatList
      horizontal
      data={products}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 12 },
});

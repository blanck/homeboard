import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native';
import useStore from '../store';
import {formatPublishedTime} from '../utils/formatting';
import {translate} from '../utils/translations';
import {fs, sp} from '../utils/scale';
import WidgetCard from '../components/WidgetCard';

// The news list skips this many, so the two columns never repeat a story
export const HEADLINE_COUNT = 3;

const HeadlinesWidget = () => {
  const articles = useStore((s) => s.articles);
  const showArticle = useStore((s) => s.showArticle);
  const lang = useStore((s) => s.config.language || 'en');
  const top = (articles || []).slice(0, HEADLINE_COUNT);

  return (
    <WidgetCard variant="light">
      <Text style={styles.title}>{translate('topStories', lang)}</Text>
      <View style={styles.list}>
        {top.map((article, index) => (
          <TouchableOpacity
            key={article.url || index}
            style={styles.card}
            onPress={() => showArticle(article)}>
            {article.urlToImage ? (
              <Image source={{uri: article.urlToImage}} style={styles.image} />
            ) : null}
            <View style={styles.text}>
              <Text style={styles.headline} numberOfLines={3}>
                {article.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[article.source?.name, formatPublishedTime(article.publishedAt)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </WidgetCard>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: fs(12),
    fontWeight: '500',
    color: '#555555',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  list: {
    flex: 1,
    gap: sp(8),
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  image: {
    width: '42%',
    height: '100%',
  },
  text: {
    flex: 1,
    padding: sp(10),
    justifyContent: 'space-between',
  },
  headline: {
    fontSize: fs(15),
    fontWeight: 'bold',
    color: '#222222',
    lineHeight: fs(19),
  },
  meta: {
    fontSize: fs(11),
    color: '#666666',
    marginTop: 4,
  },
});

export default HeadlinesWidget;
